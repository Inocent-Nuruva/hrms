"use client"

import { DateInput } from "@/components/ui/date-input"
import { DateTimeInput } from "@/components/ui/date-time-input"
import * as React from "react"
import { toast } from "@/components/ui/fluent-toast-store"
import { showSuccessAlert } from "@/lib/success-alert"
import { env } from "@/lib/env"
import ReactFlagsSelect from "react-flags-select"
import { countries as countryCodes } from "country-flag-icons"

import { CountryFlag } from "@/components/country-flag"
import {
  BadgeCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { InfoLabel } from "@fluentui/react-components"

import {
  createEmployeeProfile,
  ensureDraftOnboardingRequest,
  getOnboardingRequest,
  getCurrentAdmin,
  getCurrentEmployee,
  listAccessControlResources,
  listAttendanceDevices,
  listBranches,
  listDepartmentPositions,
  listDepartments,
  listEmployees,
  listMyOnboardingRequests,
  listOnboardingWorkflows,
  listPositions,
  listShiftResources,
  listTimetableResources,
  submitMyOnboardingDetails,
  updateMyEmployeeProfile,
  type AdminRecord,
  type CreateEmployeePayload,
  type CreateEmployeeResponse,
  type OnboardingAttendanceMode,
} from "@/lib/admin-api"
import { notifySubmittedRequestApprovers } from "@/lib/request-notifications"
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { asRecord, isLikelyRefreshToken, readString } from "@/utils/token-utils"
import { cn } from "@/lib/utils"
import { buildEmployeeOnboardingInput } from "@/lib/onboarding-provisioning"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { EMPLOYEE_REGISTRATION_PERMISSION, hasPermission } from "@/lib/dashboard-permissions"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const LEGACY_TOKEN_STORAGE_KEY = "ess_auth_token"

type RegisterFormState = {
  employeeNo: string
  firstName: string
  middleName: string
  lastName: string
  preferredName: string
  branch: string
  department: string
  position: string
  gender: string
  maritalStatus: string
  nationality: string
  profilePhotoUrl: string
  roleId: string | number
  employmentType: EmploymentType
  reportsTo: string
}

type EmploymentType = (typeof EMPLOYMENT_TYPE_OPTIONS)[number]["value"]

type InitializedRegistrationFields = {
  employeeNo: string
  firstName: string
  middleName: string
  lastName: string
  branch: string
  department: string
  position: string
  profilePhotoUrl: string
  roleId: string
}

type ContactFormState = {
  contactType: string
  isPrimary: boolean
  countryIso: string
  phoneNumber: string
  email: string
  notes: string
}

type InviteContactFormState = {
  countryIso: string
  phoneNumber: string
  email: string
}

type AddressFormState = {
  addressType: string
  isPrimary: boolean
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  country: string
  postalCode: string
}

type RelativeFormState = {
  isEmergencyContact: boolean
  isPrimary: boolean
  fullName: string
  relationship: string
  phone: string
  email: string
  address: string
  occupation: string
}

type IdentificationFormState = {
  identificationType: string
  isPrimary: boolean
  identificationNumber: string
  issuedCountry: string
  expiryDate: string
}

type BankAccountFormState = {
  paymentMode: "bank" | "mobile_money"
  isPrimary: boolean
  bankName: string
  accountName: string
  accountNumber: string
  branchName: string
  swiftCode: string
  mobileMoneyProvider: string
}

type AcademicQualificationFormState = {
  countryOfResidence: string
  educationLevel: string
  institutionName: string
  degreeOrCertificate: string
  fieldOfStudy: string
  startDate: string
  endDate: string
  certificateUrl: string
}

type ProfessionalQualificationFormState = {
  countryOfResidence: string
  institutionName: string
  programmeName: string
  issuingOrganization: string
  issueDate: string
  expiryDate: string
  certificateUrl: string
}

type ExperienceDetailFormState = {
  companyName: string
  jobTitle: string
  responsibilities: string
  startDate: string
  endDate: string
  currentlyWorking: boolean
}

type OnboardingShiftAssignmentFormState = {
  shiftId: string
  effectiveFrom: string
  effectiveTo: string
  rotationGroupId: string
  isPrimary: boolean
}

type OnboardingTimetableAssignmentFormState = {
  timetableId: string
  effectiveFrom: string
  effectiveTo: string
}

type OnboardingDeviceAssignmentFormState = {
  enabled: boolean
  employeeNo: string
  accessGroupId: string
  organizationId: string
  validEnabled: boolean
  validBeginTime: string
  validEndTime: string
  localUiRight: boolean
  closeDelayEnabled: boolean
  maxOpenDoorTime: string
  openDoorTime: string
  userVerifyMode: string
  deviceIds: number[]
  syncNow: boolean
  continueOnError: boolean
}

type OnboardingFormState = {
  enabled: boolean
  autoStart: boolean
  workflowId: string
  title: string
  description: string
  plannedStartDate: string
  plannedCompletionDate: string
  submit: boolean
  roleIds: number[]
  branchAccessIds: number[]
  attendanceMode: "" | OnboardingAttendanceMode
  shiftAssignment: OnboardingShiftAssignmentFormState
  timetableAssignment: OnboardingTimetableAssignmentFormState
  deviceAssignment: OnboardingDeviceAssignmentFormState
}

const EMPTY_FORM: RegisterFormState = {
  employeeNo: "",
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  branch: "",
  department: "",
  position: "",
  gender: "",
  maritalStatus: "",
  nationality: "",
  profilePhotoUrl: "",
  roleId: "",
  employmentType: "full_time",
  reportsTo: "",
}

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "probation", label: "Probation" },
  { value: "intern", label: "Intern" },
  { value: "consultant", label: "Consultant" },
  { value: "temporary", label: "Temporary" },
] as const

const EMPTY_INITIALIZED_FIELDS: InitializedRegistrationFields = {
  employeeNo: "",
  firstName: "",
  middleName: "",
  lastName: "",
  branch: "",
  department: "",
  position: "",
  profilePhotoUrl: "",
  roleId: "",
}

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"]
const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed"]
const CONTACT_TYPE_OPTIONS = ["personal", "work"]
const ADDRESS_TYPE_OPTIONS = ["home", "work", "other"]
const RELATIONSHIP_OPTIONS = ["parent", "spouse", "sibling", "child", "guardian", "other"]
const IDENTIFICATION_TYPE_OPTIONS = ["national_id", "passport", "driving_license", "voter_id", "other"]
const MOBILE_MONEY_PROVIDER_OPTIONS = ["none", "M-Pesa", "Airtel Money", "Tigo Pesa", "Halopesa"]
const DEFAULT_MOBILE_MONEY_PROVIDER = MOBILE_MONEY_PROVIDER_OPTIONS.find((option) => option !== "none") ?? "M-Pesa"
const EMPTY_CONTACT: ContactFormState = {
  contactType: "personal",
  isPrimary: false,
  countryIso: "TZ",
  phoneNumber: "",
  email: "",
  notes: "",
}

const EMPTY_INVITE_CONTACT: InviteContactFormState = {
  countryIso: "TZ",
  phoneNumber: "",
  email: "",
}

const EMPTY_ADDRESS: AddressFormState = {
  addressType: "home",
  isPrimary: false,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "Tanzania",
  postalCode: "",
}

const EMPTY_RELATIVE: RelativeFormState = {
  isEmergencyContact: false,
  isPrimary: false,
  fullName: "",
  relationship: "",
  phone: "",
  email: "",
  address: "",
  occupation: "",
}

const EMPTY_IDENTIFICATION: IdentificationFormState = {
  identificationType: "national_id",
  isPrimary: false,
  identificationNumber: "",
  issuedCountry: "Tanzania",
  expiryDate: "",
}

const EMPTY_BANK_ACCOUNT: BankAccountFormState = {
  paymentMode: "bank",
  isPrimary: false,
  bankName: "",
  accountName: "",
  accountNumber: "",
  branchName: "",
  swiftCode: "",
  mobileMoneyProvider: "none",
}

const EMPTY_ACADEMIC: AcademicQualificationFormState = {
  countryOfResidence: "",
  educationLevel: "",
  institutionName: "",
  degreeOrCertificate: "",
  fieldOfStudy: "",
  startDate: "",
  endDate: "",
  certificateUrl: "",
}

const EMPTY_PROFESSIONAL: ProfessionalQualificationFormState = {
  countryOfResidence: "",
  institutionName: "",
  programmeName: "",
  issuingOrganization: "",
  issueDate: "",
  expiryDate: "",
  certificateUrl: "",
}

const EMPTY_EXPERIENCE: ExperienceDetailFormState = {
  companyName: "",
  jobTitle: "",
  responsibilities: "",
  startDate: "",
  endDate: "",
  currentlyWorking: true,
}

const EMPTY_ONBOARDING_SHIFT_ASSIGNMENT: OnboardingShiftAssignmentFormState = {
  shiftId: "",
  effectiveFrom: "",
  effectiveTo: "",
  rotationGroupId: "",
  isPrimary: true,
}

const EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT: OnboardingTimetableAssignmentFormState = {
  timetableId: "",
  effectiveFrom: "",
  effectiveTo: "",
}

const EMPTY_ONBOARDING_DEVICE_ASSIGNMENT: OnboardingDeviceAssignmentFormState = {
  enabled: false,
  employeeNo: "",
  accessGroupId: "",
  organizationId: "",
  validEnabled: false,
  validBeginTime: "",
  validEndTime: "",
  localUiRight: false,
  closeDelayEnabled: false,
  maxOpenDoorTime: "",
  openDoorTime: "",
  userVerifyMode: "",
  deviceIds: [],
  syncNow: true,
  continueOnError: false,
}

const EMPTY_ONBOARDING_FORM: OnboardingFormState = {
  enabled: false,
  autoStart: true,
  workflowId: "",
  title: "",
  description: "",
  plannedStartDate: "",
  plannedCompletionDate: "",
  submit: false,
  roleIds: [],
  branchAccessIds: [],
  attendanceMode: "",
  shiftAssignment: { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
  timetableAssignment: { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
  deviceAssignment: { ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT },
}

function createEmptyOnboardingForm(): OnboardingFormState {
  return {
    ...EMPTY_ONBOARDING_FORM,
    shiftAssignment: { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
    timetableAssignment: { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
    deviceAssignment: { ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT },
  }
}

const REGISTER_STEP_ORDER = [
  "details",
  "contacts",
  "addresses",
  "relatives",
  "identifications",
  "bankAccounts",
  "academic",
  "professional",
  "experience",
] as const

const REGISTER_STEP_LABELS: Record<RegisterStep, string> = {
  details: "Details",
  contacts: "Contacts",
  addresses: "Addresses",
  relatives: "Relatives",
  identifications: "IDs",
  bankAccounts: "Bank",
  academic: "Academic",
  professional: "Professional",
  experience: "Experience",
}

type RegisterStep = (typeof REGISTER_STEP_ORDER)[number]
type DeleteEntityKind =
  "contact" | "address" | "relative" | "identification" | "bankAccount" | "academic" | "professional" | "experience"

type CountryIso = "TZ" | "KE" | "UG" | "RW" | "BI" | "ZM" | "ZA" | "GB" | "US"

const COUNTRY_DIAL_BY_ISO: Record<CountryIso, string> = {
  TZ: "+255",
  KE: "+254",
  UG: "+256",
  RW: "+250",
  BI: "+257",
  ZM: "+260",
  ZA: "+27",
  GB: "+44",
  US: "+1",
}

const COUNTRY_LABELS: Record<CountryIso, { primary: string; secondary: string }> = {
  TZ: { primary: "Tanzania", secondary: "+255" },
  KE: { primary: "Kenya", secondary: "+254" },
  UG: { primary: "Uganda", secondary: "+256" },
  RW: { primary: "Rwanda", secondary: "+250" },
  BI: { primary: "Burundi", secondary: "+257" },
  ZM: { primary: "Zambia", secondary: "+260" },
  ZA: { primary: "South Africa", secondary: "+27" },
  GB: { primary: "United Kingdom", secondary: "+44" },
  US: { primary: "United States", secondary: "+1" },
}

function joinPhoneWithCountryCode(countryCode: string, phoneNumber: string) {
  const phone = phoneNumber.trim()
  if (!phone) {
    return ""
  }
  if (phone.startsWith("+")) {
    return phone
  }
  return `${countryCode}${phone}`
}

function toAdminRecordArray(value: unknown): AdminRecord[] {
  const record = asRecord(value)
  if (record) {
    return [record as AdminRecord]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => asRecord(entry)).filter((entry): entry is AdminRecord => entry !== null)
}

function getDialCodeForCountry(isoCode: string) {
  if (isoCode in COUNTRY_DIAL_BY_ISO) {
    return COUNTRY_DIAL_BY_ISO[isoCode as keyof typeof COUNTRY_DIAL_BY_ISO]
  }
  return COUNTRY_DIAL_BY_ISO.TZ
}

function resolveCountryIsoFromPhoneNumber(phoneNumber: string): CountryIso {
  const normalizedPhone = phoneNumber.trim()
  const match = (Object.entries(COUNTRY_DIAL_BY_ISO) as Array<[CountryIso, string]>).find(([, dialCode]) =>
    normalizedPhone.startsWith(dialCode)
  )
  return match?.[0] ?? "TZ"
}

function normalizePhoneNumberForContact(phoneNumber: string, countryIso: CountryIso): string {
  const normalizedPhone = phoneNumber.trim()
  if (!normalizedPhone) {
    return ""
  }

  if (!normalizedPhone.startsWith("+")) {
    return normalizedPhone.replace(/\D+/g, "")
  }

  const dialCode = getDialCodeForCountry(countryIso)
  if (normalizedPhone.startsWith(dialCode)) {
    return normalizedPhone.slice(dialCode.length).replace(/\D+/g, "")
  }

  return normalizedPhone.replace(/^\+\d{1,4}/, "").replace(/\D+/g, "")
}

function resolveInitialPrimaryContact(sources: Array<AdminRecord | null>): ContactFormState | null {
  for (const source of sources) {
    if (!source) {
      continue
    }

    const sourceContacts = [
      ...toAdminRecordArray(source.contacts),
      ...toAdminRecordArray(source.contact),
      ...toAdminRecordArray(source.primary_contact ? [source.primary_contact] : []),
    ]
    const primaryContact =
      sourceContacts.find((contact) => contact.is_primary === true || String(contact.is_primary ?? "") === "true") ??
      sourceContacts[0] ??
      null
    const email = (
      readString(primaryContact, ["email", "email_address"]) ??
      readString(source, ["email", "work_email", "email_address"]) ??
      ""
    ).toLowerCase()
    const rawPhone =
      readString(primaryContact, ["phone_number", "phone", "mobile_number", "mobile"]) ??
      readString(source, ["phone_number", "phone", "mobile_number", "mobile"]) ??
      ""

    if (!email && !rawPhone) {
      continue
    }

    const countryIso = resolveCountryIsoFromPhoneNumber(rawPhone)
    return {
      contactType: readString(primaryContact, ["contact_type", "type"]) ?? "work",
      isPrimary: true,
      countryIso,
      phoneNumber: normalizePhoneNumberForContact(rawPhone, countryIso),
      email,
      notes: readString(primaryContact, ["notes", "note"]) ?? "Prefilled from your primary employee contact.",
    }
  }

  return null
}

type RoleOption = {
  id: string
  label: string
  name: string
}

function normalizeRoleText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
}

function resolveDefaultRoleId(roleOptions: RoleOption[]) {
  if (roleOptions.length === 0) {
    return ""
  }

  const exactUser = roleOptions.find(
    (role) => normalizeRoleText(role.name) === "user" || normalizeRoleText(role.label) === "user"
  )
  if (exactUser) {
    return exactUser.id
  }

  const includesUser = roleOptions.find(
    (role) => normalizeRoleText(role.name).includes("user") || normalizeRoleText(role.label).includes("user")
  )
  if (includesUser) {
    return includesUser.id
  }

  return roleOptions[0]?.id ?? ""
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function readRecordId(record: AdminRecord | null) {
  if (!record) {
    return null
  }
  for (const key of ["id", "request_id", "requestId"]) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readNumberish(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function relatedDepartmentIds(record: AdminRecord) {
  const ids = new Set<number>()
  for (const value of [
    record.department_id,
    record.departmentId,
    record.primary_department_id,
    record.primaryDepartmentId,
  ]) {
    const id = readNumberish(value)
    if (id !== null) ids.add(id)
  }
  for (const key of ["department", "departmentDetail", "primary_department", "primaryDepartment"]) {
    const id = readRecordId(asRecord(record[key]))
    if (id !== null) ids.add(id)
  }

  const directIds = Array.isArray(record.department_ids)
    ? record.department_ids
    : Array.isArray(record.departmentIds)
      ? record.departmentIds
      : []
  for (const value of directIds) {
    const id = readNumberish(value)
    if (id !== null) ids.add(id)
  }

  const assignments = Array.isArray(record.departments) ? record.departments : []
  for (const value of assignments) {
    // Some APIs return department id arrays like [1, 2] instead of assignment objects.
    const directAssignmentId = readNumberish(value)
    if (directAssignmentId !== null && (typeof value === "number" || typeof value === "string")) {
      ids.add(directAssignmentId)
      continue
    }
    const assignment = asRecord(value)
    if (!assignment) continue
    const nestedDepartment = asRecord(assignment.department) ?? asRecord(assignment.departmentDetail)
    const id =
      readNumberish(assignment.department_id) ??
      readNumberish(assignment.departmentId) ??
      readRecordId(nestedDepartment) ??
      readRecordId(assignment)
    if (id !== null) ids.add(id)
  }
  return ids
}

function relatedBranchId(record: AdminRecord) {
  return (
    readRecordId(asRecord(record.branch)) ??
    readRecordId(asRecord(record.primary_branch)) ??
    readRecordId(asRecord(record.primaryBranch)) ??
    readNumberish(record.branch_id) ??
    readNumberish(record.branchId) ??
    readNumberish(record.primary_branch_id) ??
    readNumberish(record.primaryBranchId)
  )
}

function recordOptionLabel(record: AdminRecord, extraKeys: string[] = []) {
  return (
    readString(record, [
      ...extraKeys,
      "name",
      "title",
      "department_name",
      "departmentName",
      "position_name",
      "positionName",
      "branch_name",
      "branchName",
      "code",
    ]) ?? null
  )
}

function normalizeDepartmentPositionRows(rows: AdminRecord[], departmentId: number) {
  return rows.map((row) => {
    const nestedPosition =
      asRecord(row.position) ??
      asRecord(row.positionDetail) ??
      asRecord(row.primary_position) ??
      asRecord(row.primaryPosition)
    const position = nestedPosition ? ({ ...row, ...nestedPosition } as AdminRecord) : row
    const existingIds = relatedDepartmentIds(position)
    existingIds.add(departmentId)
    return {
      ...position,
      department_id: position.department_id ?? departmentId,
      department_ids: Array.from(existingIds),
    } as AdminRecord
  })
}

function toggleNumericId(currentValues: number[], id: number, checked: boolean) {
  if (checked) {
    return currentValues.includes(id) ? currentValues : [...currentValues, id]
  }
  return currentValues.filter((value) => value !== id)
}

function findRecordByName(records: AdminRecord[], selectedName: string) {
  const normalized = selectedName.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return (
    records.find((record) => {
      const label = recordOptionLabel(record)
      return (label ?? "").trim().toLowerCase() === normalized
    }) ?? null
  )
}

function uniqueOptionLabels(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const value of values) {
    if (typeof value !== "string") continue
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(value)
  }
  return unique
}

function toRoleOption(record: AdminRecord): RoleOption | null {
  const idValue = record.id
  const id = typeof idValue === "number" || typeof idValue === "string" ? String(idValue) : null
  if (!id) {
    return null
  }

  const name = toText(record.name) ?? `role_${id}`
  const label = toText(record.display_name) ?? name
  return { id, label, name }
}

function normalizeRolesPayload(payload: unknown): AdminRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is AdminRecord => typeof entry === "object" && entry !== null)
  }
  if (typeof payload !== "object" || payload === null) {
    return []
  }
  const record = payload as AdminRecord
  const nestedCandidates = [record.data, record.items, record.results, record.rows]
  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((entry): entry is AdminRecord => typeof entry === "object" && entry !== null)
    }
  }
  return []
}

async function fetchRolesDirect(accessToken: string) {
  const endpoint = `${env.NEXT_PUBLIC_API_BASE_URL}/api/roles`

  // Roles endpoint is auth-protected in this environment.
  const authedResponse = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  })
  if (authedResponse.ok) {
    return normalizeRolesPayload((await authedResponse.json()) as unknown)
  }

  // Graceful fallback for environments where roles may be exposed without auth.
  const directResponse = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
  })
  if (!directResponse.ok) {
    throw new Error(`Request failed with status ${authedResponse.status}`)
  }
  return normalizeRolesPayload((await directResponse.json()) as unknown)
}

function resolveAccessTokenFromStorage() {
  if (typeof window === "undefined") {
    return ""
  }

  const fromDedicatedKey = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  const legacySessionToken = window.sessionStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)?.trim() ?? ""

  let authAccessToken = ""
  let authRefreshToken = ""

  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as unknown
      if (typeof parsed === "string") {
        authAccessToken = parsed.trim()
      }

      const root = asRecord(parsed)
      const rootTokens = asRecord(root?.tokens)
      const rootData = asRecord(root?.data)
      const rootDataTokens = asRecord(rootData?.tokens)
      const candidates = [root, rootTokens, rootData, rootDataTokens]

      for (const candidate of candidates) {
        const candidateAccess = readString(candidate, ["accessToken", "access_token", "token"])
        const candidateRefresh = readString(candidate, ["refreshToken", "refresh_token"])
        if (candidateRefresh && !authRefreshToken) {
          authRefreshToken = candidateRefresh
        }
        if (candidateAccess && !isLikelyRefreshToken(candidateAccess, candidateRefresh ?? authRefreshToken)) {
          authAccessToken = candidateAccess
          break
        }
      }
    } catch {
      authAccessToken = authTokensRaw.trim()
      authRefreshToken = ""
    }
  }

  return (
    authAccessToken ||
    (fromDedicatedKey && !isLikelyRefreshToken(fromDedicatedKey, authRefreshToken) ? fromDedicatedKey : "") ||
    (legacySessionToken && !isLikelyRefreshToken(legacySessionToken, authRefreshToken) ? legacySessionToken : "")
  )
}

function readStoredAuthUser() {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
  if (!raw) {
    return null
  }

  try {
    return asRecord(JSON.parse(raw))
  } catch {
    return null
  }
}

function resolveInitializedRegistrationFields(
  sources: [AdminRecord | null, AdminRecord | null, AdminRecord | null]
): Omit<InitializedRegistrationFields, "roleId"> & { roleName: string } {
  const [currentEmployee, currentAdmin, storedUser] = sources

  const employeeUser = asRecord(currentEmployee?.user)
  const adminUser = asRecord(currentAdmin?.user)

  const employeeNo =
    readString(currentEmployee, ["employee_no", "employee_number", "employee_code", "employeeId", "user_no"]) ??
    readString(currentAdmin, ["user_no", "employee_no", "employeeId", "employee_id"]) ??
    readString(storedUser, ["employeeId", "employee_id", "employee_no", "user_no"]) ??
    ""

  const firstName =
    readString(currentEmployee, ["first_name", "firstName"]) ??
    readString(employeeUser, ["first_name", "firstName"]) ??
    readString(currentAdmin, ["first_name", "firstName"]) ??
    readString(adminUser, ["first_name", "firstName"]) ??
    ""

  const middleName =
    readString(currentEmployee, ["middle_name", "middleName"]) ??
    readString(employeeUser, ["middle_name", "middleName"]) ??
    readString(currentAdmin, ["middle_name", "middleName"]) ??
    readString(adminUser, ["middle_name", "middleName"]) ??
    ""

  const lastName =
    readString(currentEmployee, ["last_name", "lastName"]) ??
    readString(employeeUser, ["last_name", "lastName"]) ??
    readString(currentAdmin, ["last_name", "lastName"]) ??
    readString(adminUser, ["last_name", "lastName"]) ??
    ""

  const branch =
    readString(asRecord(currentEmployee?.primary_branch), ["name", "branch_name"]) ??
    readString(asRecord(currentEmployee?.branch), ["name", "branch_name"]) ??
    readString(currentEmployee, ["branch_name", "branch"]) ??
    ""

  const department =
    readString(asRecord(currentEmployee?.primary_department), ["name", "department_name"]) ??
    readString(asRecord(currentEmployee?.department), ["name", "department_name"]) ??
    readString(currentEmployee, ["department_name", "department"]) ??
    ""

  const position =
    readString(asRecord(currentEmployee?.primary_position), ["name", "position_name"]) ??
    readString(asRecord(currentEmployee?.position), ["name", "position_name"]) ??
    readString(currentEmployee, ["position_name", "position"]) ??
    ""

  const profilePhotoUrl =
    readString(currentEmployee, [
      "profile_photo_url",
      "profilePhotoUrl",
      "photo_url",
      "photoUrl",
      "avatar_url",
      "avatarUrl",
      "image_url",
      "imageUrl",
    ]) ??
    readString(employeeUser, [
      "profile_photo_url",
      "profilePhotoUrl",
      "photo_url",
      "photoUrl",
      "avatar_url",
      "avatarUrl",
      "image_url",
      "imageUrl",
    ]) ??
    readString(currentAdmin, [
      "profile_photo_url",
      "profilePhotoUrl",
      "photo_url",
      "photoUrl",
      "avatar_url",
      "avatarUrl",
      "image_url",
      "imageUrl",
    ]) ??
    readString(adminUser, [
      "profile_photo_url",
      "profilePhotoUrl",
      "photo_url",
      "photoUrl",
      "avatar_url",
      "avatarUrl",
      "image_url",
      "imageUrl",
    ]) ??
    readString(storedUser, [
      "profile_photo_url",
      "profilePhotoUrl",
      "photo_url",
      "photoUrl",
      "avatar_url",
      "avatarUrl",
      "image_url",
      "imageUrl",
    ]) ??
    ""

  const roleName =
    readString(currentAdmin, ["role", "role_name", "user_type"]) ??
    readString(adminUser, ["role", "role_name", "user_type"]) ??
    readString(storedUser, ["role", "role_name", "user_type"]) ??
    ""

  return {
    employeeNo,
    firstName,
    middleName,
    lastName,
    branch,
    department,
    position,
    profilePhotoUrl,
    roleName,
  }
}

function resolveInitializedRoleId(
  roleOptions: RoleOption[],
  sources: [AdminRecord | null, AdminRecord | null, AdminRecord | null]
) {
  const [currentEmployee, currentAdmin, storedUser] = sources
  const directRoleIdCandidates = [
    toText(currentEmployee?.role_id),
    toText(currentAdmin?.role_id),
    toText(storedUser?.role_id),
  ].filter((value): value is string => Boolean(value))

  for (const candidate of directRoleIdCandidates) {
    const match = roleOptions.find((role) => role.id === candidate)
    if (match) {
      return match.id
    }
  }

  const roleName = resolveInitializedRegistrationFields(sources).roleName
  if (!roleName) {
    return ""
  }

  const normalizedRoleName = normalizeRoleText(roleName)
  const byLabel =
    roleOptions.find((role) => normalizeRoleText(role.label) === normalizedRoleName) ??
    roleOptions.find((role) => normalizeRoleText(role.name) === normalizedRoleName) ??
    roleOptions.find(
      (role) =>
        normalizeRoleText(role.label).includes(normalizedRoleName) ||
        normalizedRoleName.includes(normalizeRoleText(role.label)) ||
        normalizeRoleText(role.name).includes(normalizedRoleName) ||
        normalizedRoleName.includes(normalizeRoleText(role.name))
    )

  return byLabel?.id ?? ""
}

const REGISTER_DRAFT_STORAGE_KEY = "hrms.employee.register.draft.v2"

type StoredRegisterDraft = {
  currentStep?: RegisterStep
  isInviteMode?: boolean
  form?: RegisterFormState
  dob?: string | null
  hireDate?: string | null
  probationEndDate?: string | null
  inviteContact?: InviteContactFormState
  contacts?: ContactFormState[]
  addresses?: AddressFormState[]
  relatives?: RelativeFormState[]
  identifications?: IdentificationFormState[]
  bankAccounts?: BankAccountFormState[]
  academicQualifications?: AcademicQualificationFormState[]
  professionalQualifications?: ProfessionalQualificationFormState[]
  experienceDetails?: ExperienceDetailFormState[]
  onboarding?: OnboardingFormState
  savedAt?: string
}

function countryNameFromIso(isoCode: string) {
  try {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
    return regionNames.of(isoCode.toUpperCase()) ?? isoCode.toUpperCase()
  } catch {
    return isoCode.toUpperCase()
  }
}

const NATIONALITY_OPTIONS = (countryCodes as string[])
  .map((code) => ({
    code,
    name: countryNameFromIso(code),
  }))
  .sort((left, right) => left.name.localeCompare(right.name))

function NationalityFlag({ code }: { code: string }) {
  return <CountryFlag code={code} className="h-3.5 w-5" />
}

function AnimatedField({
  delayMs,
  children,
  className,
}: {
  delayMs: number
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("animate-fade-up", className)} style={{ animationDelay: `${delayMs}ms`, opacity: 0 }}>
      {children}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  delayMs,
  children,
  hint,
  reserveHintSpace = false,
  className,
}: {
  label: string
  htmlFor: string
  delayMs: number
  children: React.ReactNode
  hint?: React.ReactNode
  reserveHintSpace?: boolean
  className?: string
}) {
  return (
    <AnimatedField delayMs={delayMs} className={className}>
      <div className="flex h-full flex-col gap-1">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
          {label}
        </Label>
        {children}
        {hint || reserveHintSpace ? (
          <div className="min-h-3.5 text-[11px] leading-snug text-muted-foreground">{hint}</div>
        ) : null}
      </div>
    </AnimatedField>
  )
}

function InfoTooltip({
  label,
  content,
}: {
  label: string
  content: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}) {
  return (
    <InfoLabel info={<>{content}</>} label={{ className: "sr-only" }} size="small">
      {label}
    </InfoLabel>
  )
}

function MultiSelectChecklist({
  label,
  options,
  selectedIds,
  onToggle,
  emptyText,
  hint,
}: {
  label: string
  options: Array<{ id: number; label: string; description?: string }>
  selectedIds: number[]
  onToggle: (id: number, checked: boolean) => void
  emptyText: string
  hint?: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {selectedIds.length > 0 ? (
          <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
        ) : null}
      </div>
      <div className="max-h-44 overflow-y-auto rounded-md border border-border bg-card">
        {options.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          <div className="grid gap-0.5 p-2">
            {options.map((option) => {
              const checked = selectedIds.includes(option.id)
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox checked={checked} onCheckedChange={(value) => onToggle(option.id, Boolean(value))} />
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{option.label}</span>
                    {option.description ? (
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

export function EmployeeRegisterForm() {
  const actor = useDashboardActor()
  const isRegisteringOthers = actor.ready && hasPermission(actor.permissionLabels, EMPLOYEE_REGISTRATION_PERMISSION)
  const [currentStep, setCurrentStep] = React.useState<RegisterStep>("details")
  const [tabDirection, setTabDirection] = React.useState<"forward" | "backward">("forward")
  const [form, setForm] = React.useState<RegisterFormState>(EMPTY_FORM)
  const [dob, setDob] = React.useState<Date | undefined>(undefined)
  const [contacts, setContacts] = React.useState<ContactFormState[]>([])
  const [addresses, setAddresses] = React.useState<AddressFormState[]>([])
  const [relatives, setRelatives] = React.useState<RelativeFormState[]>([])
  const [identifications, setIdentifications] = React.useState<IdentificationFormState[]>([])
  const [bankAccounts, setBankAccounts] = React.useState<BankAccountFormState[]>([])
  const [academicQualifications, setAcademicQualifications] = React.useState<AcademicQualificationFormState[]>([])
  const [professionalQualifications, setProfessionalQualifications] = React.useState<
    ProfessionalQualificationFormState[]
  >([])
  const [experienceDetails, setExperienceDetails] = React.useState<ExperienceDetailFormState[]>([])
  const [hireDate, setHireDate] = React.useState<Date | undefined>(undefined)
  const [probationEndDate, setProbationEndDate] = React.useState<Date | undefined>(undefined)
  const [isContactDialogOpen, setIsContactDialogOpen] = React.useState(false)
  const [draftContact, setDraftContact] = React.useState<ContactFormState>({
    ...EMPTY_CONTACT,
  })
  const [draftContactPhoneError, setDraftContactPhoneError] = React.useState("")
  const [draftContactEmailError, setDraftContactEmailError] = React.useState("")
  const [isInviteMode, setIsInviteMode] = React.useState(false)
  const [inviteContact, setInviteContact] = React.useState<InviteContactFormState>({
    ...EMPTY_INVITE_CONTACT,
  })
  const [invitePhoneError, setInvitePhoneError] = React.useState("")
  const [inviteEmailError, setInviteEmailError] = React.useState("")
  const [editingContactIndex, setEditingContactIndex] = React.useState<number | null>(null)
  const [isAddressDialogOpen, setIsAddressDialogOpen] = React.useState(false)
  const [draftAddress, setDraftAddress] = React.useState<AddressFormState>({
    ...EMPTY_ADDRESS,
  })
  const [editingAddressIndex, setEditingAddressIndex] = React.useState<number | null>(null)
  const [isRelativeDialogOpen, setIsRelativeDialogOpen] = React.useState(false)
  const [draftRelative, setDraftRelative] = React.useState<RelativeFormState>({
    ...EMPTY_RELATIVE,
  })
  const [editingRelativeIndex, setEditingRelativeIndex] = React.useState<number | null>(null)
  const [isIdentificationDialogOpen, setIsIdentificationDialogOpen] = React.useState(false)
  const [draftIdentification, setDraftIdentification] = React.useState<IdentificationFormState>({
    ...EMPTY_IDENTIFICATION,
  })
  const [editingIdentificationIndex, setEditingIdentificationIndex] = React.useState<number | null>(null)
  const [isBankDialogOpen, setIsBankDialogOpen] = React.useState(false)
  const [draftBankAccount, setDraftBankAccount] = React.useState<BankAccountFormState>({
    ...EMPTY_BANK_ACCOUNT,
  })
  const [editingBankIndex, setEditingBankIndex] = React.useState<number | null>(null)

  const [isAcademicDialogOpen, setIsAcademicDialogOpen] = React.useState(false)
  const [draftAcademic, setDraftAcademic] = React.useState<AcademicQualificationFormState>({ ...EMPTY_ACADEMIC })
  const [editingAcademicIndex, setEditingAcademicIndex] = React.useState<number | null>(null)

  const [isProfessionalDialogOpen, setIsProfessionalDialogOpen] = React.useState(false)
  const [draftProfessional, setDraftProfessional] = React.useState<ProfessionalQualificationFormState>({
    ...EMPTY_PROFESSIONAL,
  })
  const [editingProfessionalIndex, setEditingProfessionalIndex] = React.useState<number | null>(null)

  const [isExperienceDialogOpen, setIsExperienceDialogOpen] = React.useState(false)
  const [draftExperience, setDraftExperience] = React.useState<ExperienceDetailFormState>({ ...EMPTY_EXPERIENCE })
  const [editingExperienceIndex, setEditingExperienceIndex] = React.useState<number | null>(null)

  const [pendingDelete, setPendingDelete] = React.useState<{
    kind: DeleteEntityKind
    index: number
    label: string
  } | null>(null)
  const [roles, setRoles] = React.useState<RoleOption[]>([])
  const [branchRecords, setBranchRecords] = React.useState<AdminRecord[]>([])
  const [departmentRecords, setDepartmentRecords] = React.useState<AdminRecord[]>([])
  const [positionRecords, setPositionRecords] = React.useState<AdminRecord[]>([])
  const [departmentPositionRecords, setDepartmentPositionRecords] = React.useState<AdminRecord[]>([])
  const [departmentPositionsLoading, setDepartmentPositionsLoading] = React.useState(false)
  const [departmentPositionsLoaded, setDepartmentPositionsLoaded] = React.useState(false)
  const [reportsToRecords, setReportsToRecords] = React.useState<AdminRecord[]>([])
  const [onboardingWorkflows, setOnboardingWorkflows] = React.useState<AdminRecord[]>([])
  const [shiftRecords, setShiftRecords] = React.useState<AdminRecord[]>([])
  const [rotationGroupRecords, setRotationGroupRecords] = React.useState<AdminRecord[]>([])
  const [timetableRecords, setTimetableRecords] = React.useState<AdminRecord[]>([])
  const [accessGroupRecords, setAccessGroupRecords] = React.useState<AdminRecord[]>([])
  const [accessOrganizationRecords, setAccessOrganizationRecords] = React.useState<AdminRecord[]>([])
  const [attendanceDeviceRecords, setAttendanceDeviceRecords] = React.useState<AdminRecord[]>([])
  const [onboarding, setOnboarding] = React.useState<OnboardingFormState>(createEmptyOnboardingForm)
  const [, setRolesLoading] = React.useState(false)
  const [, setRolesError] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [employeeNoTouched, setEmployeeNoTouched] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [createdEmployeeResult, setCreatedEmployeeResult] = React.useState<CreateEmployeeResponse | null>(null)
  const [initializedFields, setInitializedFields] =
    React.useState<InitializedRegistrationFields>(EMPTY_INITIALIZED_FIELDS)
  const [registrationContextResolved, setRegistrationContextResolved] = React.useState(false)
  const [selfRegistrationStatus, setSelfRegistrationStatus] = React.useState("")
  const [savedRegisterDraft, setSavedRegisterDraft] = React.useState<StoredRegisterDraft | null>(null)
  const [registerDraftReady, setRegisterDraftReady] = React.useState(false)

  const lockedFields = React.useMemo(
    () => ({
      employeeNo: !isRegisteringOthers && Boolean(initializedFields.employeeNo),
      firstName: false,
      middleName: false,
      lastName: false,
      preferredName: false,
      branch: !isRegisteringOthers && Boolean(initializedFields.branch),
      department: !isRegisteringOthers && Boolean(initializedFields.department),
      position: !isRegisteringOthers && Boolean(initializedFields.position),
      reportsTo: false,
      employmentType: false,
      roleId: true,
    }),
    [initializedFields, isRegisteringOthers]
  )
  const branchOptions = React.useMemo(
    () =>
      uniqueOptionLabels(
        branchRecords
          .map((row) => recordOptionLabel(row, ["branch_name", "branchName"]))
          .filter((name) => name !== null && name !== "-")
      ),
    [branchRecords]
  )
  const selectedBranchRecord = React.useMemo(
    () => findRecordByName(branchRecords, form.branch),
    [branchRecords, form.branch]
  )
  const selectedBranchId = React.useMemo(() => readRecordId(selectedBranchRecord), [selectedBranchRecord])
  const departmentsForSelectedBranch = React.useMemo(() => {
    if (selectedBranchId === null) {
      return []
    }
    const matching = departmentRecords.filter((row) => relatedBranchId(row) === selectedBranchId)
    if (matching.length > 0) {
      return matching
    }
    // Fallback for legacy records with no branch link.
    return departmentRecords.filter((row) => relatedBranchId(row) === null)
  }, [departmentRecords, selectedBranchId])
  const departmentOptions = React.useMemo(
    () =>
      uniqueOptionLabels(
        departmentsForSelectedBranch
          .map((row) => recordOptionLabel(row, ["department_name", "departmentName"]))
          .filter((name) => name !== null && name !== "-")
      ),
    [departmentsForSelectedBranch]
  )
  const selectedDepartmentRecord = React.useMemo(
    () => findRecordByName(departmentsForSelectedBranch, form.department),
    [departmentsForSelectedBranch, form.department]
  )
  const selectedDepartmentId = React.useMemo(() => readRecordId(selectedDepartmentRecord), [selectedDepartmentRecord])

  React.useEffect(() => {
    if (selectedDepartmentId === null) {
      setDepartmentPositionRecords([])
      setDepartmentPositionsLoaded(false)
      setDepartmentPositionsLoading(false)
      return
    }

    const accessToken = resolveAccessTokenFromStorage()
    if (!accessToken) {
      setDepartmentPositionRecords([])
      setDepartmentPositionsLoaded(false)
      setDepartmentPositionsLoading(false)
      return
    }

    let cancelled = false
    setDepartmentPositionsLoading(true)
    setDepartmentPositionsLoaded(false)
    void listDepartmentPositions(accessToken, selectedDepartmentId)
      .then((rows) => {
        if (cancelled) return
        setDepartmentPositionRecords(normalizeDepartmentPositionRows(rows, selectedDepartmentId))
        setDepartmentPositionsLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        // Fall back to client-side filtering of the full positions list.
        setDepartmentPositionRecords([])
        setDepartmentPositionsLoaded(false)
      })
      .finally(() => {
        if (!cancelled) {
          setDepartmentPositionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedDepartmentId])

  const positionOptions = React.useMemo(() => {
    // Cascade: positions only after a department is selected.
    if (selectedDepartmentId === null) {
      return []
    }

    // Prefer department-scoped API results when the endpoint succeeds (even if empty).
    if (departmentPositionsLoaded) {
      return uniqueOptionLabels(
        departmentPositionRecords
          .map((row) => recordOptionLabel(row, ["position_name", "positionName"]))
          .filter((name) => name !== null && name !== "-")
      )
    }

    // Fallback: filter full positions list by department (and branch when known).
    const byDepartment = positionRecords.filter((row) => {
      const departmentIds = relatedDepartmentIds(row)
      return departmentIds.has(selectedDepartmentId)
    })
    if (byDepartment.length > 0) {
      return uniqueOptionLabels(
        byDepartment
          .map((row) => recordOptionLabel(row, ["position_name", "positionName"]))
          .filter((name) => name !== null && name !== "-")
      )
    }

    // Last resort: positions with no department link, optionally constrained by branch.
    return uniqueOptionLabels(
      positionRecords
        .filter((row) => {
          const departmentIds = relatedDepartmentIds(row)
          if (departmentIds.size > 0) {
            return false
          }
          const branchId = relatedBranchId(row)
          return selectedBranchId === null || branchId === null || branchId === selectedBranchId
        })
        .map((row) => recordOptionLabel(row, ["position_name", "positionName"]))
        .filter((name) => name !== null && name !== "-")
    )
  }, [departmentPositionRecords, departmentPositionsLoaded, positionRecords, selectedBranchId, selectedDepartmentId])
  const reportsToOptions = React.useMemo(() => {
    return reportsToRecords
      .filter((row) => {
        if (selectedDepartmentId === null) {
          return true
        }
        return relatedDepartmentIds(row).has(selectedDepartmentId)
      })
      .map((row) => {
        const id = readRecordId(row)
        const composedName = [row.firstName ?? row.first_name, row.lastName ?? row.last_name]
          .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
          .join(" ")
          .trim()
        const label =
          readString(row, [
            "fullName",
            "full_name",
            "displayName",
            "display_name",
            "name",
            "firstName",
            "first_name",
          ]) ||
          composedName ||
          readString(row, ["employeeNo", "employee_no", "user_no"]) ||
          (id != null ? `Employee #${id}` : null)
        return id != null && label ? { id, label } : null
      })
      .filter((o): o is { id: number; label: string } => o !== null)
  }, [reportsToRecords, selectedDepartmentId])
  const selectedReportsToLabel = React.useMemo(
    () => reportsToOptions.find((option) => String(option.id) === String(form.reportsTo))?.label ?? "",
    [form.reportsTo, reportsToOptions]
  )
  const selectedEmploymentTypeLabel = React.useMemo(
    () =>
      EMPLOYMENT_TYPE_OPTIONS.find((option) => option.value === (form.employmentType || "full_time"))?.label ??
      "Full Time",
    [form.employmentType]
  )
  React.useEffect(() => {
    if (form.branch && !branchOptions.includes(form.branch)) {
      updateField("branch", "")
    }
  }, [branchOptions, form.branch])

  React.useEffect(() => {
    if (form.department && !departmentOptions.includes(form.department)) {
      updateField("department", "")
    }
  }, [departmentOptions, form.department])

  React.useEffect(() => {
    if (form.position && !positionOptions.includes(form.position)) {
      updateField("position", "")
    }
  }, [form.position, positionOptions])

  React.useEffect(() => {
    if (form.reportsTo && !reportsToOptions.some((option) => String(option.id) === String(form.reportsTo))) {
      updateField("reportsTo", "")
    }
  }, [form.reportsTo, reportsToOptions])

  const onboardingWorkflowOptions = React.useMemo(
    () =>
      onboardingWorkflows
        .map((row) => {
          const id = readRecordId(row)
          if (id === null) {
            return null
          }
          return {
            id,
            label: readString(row, ["name", "title", "workflow_name", "workflowName", "code"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [onboardingWorkflows]
  )
  const shiftOptions = React.useMemo(
    () =>
      shiftRecords
        .map((row) => {
          const id = readRecordId(row)
          if (id === null) {
            return null
          }
          return {
            id,
            label: readString(row, ["name", "title", "shift_name", "shiftName", "code"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [shiftRecords]
  )
  const rotationGroupOptions = React.useMemo(
    () =>
      rotationGroupRecords
        .map((row) => {
          const id =
            readRecordId(row) ??
            (typeof row.rotation_group_id === "number"
              ? row.rotation_group_id
              : typeof row.rotationGroupId === "number"
                ? row.rotationGroupId
                : null)
          if (id === null) {
            return null
          }
          const name = readString(row, ["name", "title", "rotation_group_name", "rotationGroupName"])
          const code = readString(row, ["code", "rotation_group_code", "rotationGroupCode"])
          const label =
            name !== "-" && code !== "-"
              ? `${name} (${code})`
              : name !== "-"
                ? name
                : code !== "-"
                  ? code
                  : `Rotation group #${id}`
          return { id, label }
        })
        .filter((option): option is { id: number; label: string } => option !== null),
    [rotationGroupRecords]
  )
  const timetableOptions = React.useMemo(
    () =>
      timetableRecords
        .map((row) => {
          const id = readRecordId(row)
          if (id === null) {
            return null
          }
          return {
            id,
            label: readString(row, ["name", "title", "timetable_name", "timetableName", "code"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [timetableRecords]
  )
  const accessGroupOptions = React.useMemo(
    () =>
      accessGroupRecords
        .map((row) => {
          const id = readRecordId(row)
          if (id === null) {
            return null
          }
          return { id, label: readString(row, ["name", "title"]) }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [accessGroupRecords]
  )
  const accessOrganizationOptions = React.useMemo(
    () =>
      accessOrganizationRecords
        .map((row) => {
          const id = readRecordId(row)
          if (id === null) {
            return null
          }
          return { id, label: readString(row, ["name", "title"]) }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [accessOrganizationRecords]
  )
  const attendanceDeviceOptions = React.useMemo(
    () =>
      attendanceDeviceRecords
        .map((row) => {
          const id = readRecordId(row)
          if (id === null) {
            return null
          }
          const primary = readString(row, ["name", "device_name", "title", "serial_no"])
          const secondary = readString(row, ["serial_no", "device_code", "ip_address"])
          return {
            id,
            label: secondary !== "-" && secondary !== primary ? `${primary} (${secondary})` : primary,
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [attendanceDeviceRecords]
  )
  const branchAccessOptions = React.useMemo(
    () =>
      branchRecords
        .map((row) => {
          const id = readRecordId(row)
          if (id === null) {
            return null
          }
          return { id, label: readString(row, ["name", "title"]) }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [branchRecords]
  )
  const onboardingRoleOptions = React.useMemo(
    () =>
      roles
        .map((role) => ({
          id: Number(role.id),
          label: role.label || role.name,
        }))
        .filter((role) => Number.isFinite(role.id)),
    [roles]
  )
  const currentStepIndex = REGISTER_STEP_ORDER.indexOf(currentStep)
  const visibleRegisterSteps: readonly RegisterStep[] = isInviteMode ? ["details"] : REGISTER_STEP_ORDER
  const visibleCurrentStepIndex = visibleRegisterSteps.indexOf(currentStep as (typeof visibleRegisterSteps)[number])
  const currentVisibleStepIndex = visibleCurrentStepIndex === -1 ? 0 : visibleCurrentStepIndex
  const previousVisibleStep = currentVisibleStepIndex > 0 ? visibleRegisterSteps[currentVisibleStepIndex - 1] : null
  const nextVisibleStep =
    currentStepIndex < REGISTER_STEP_ORDER.length - 1
      ? (visibleRegisterSteps[currentVisibleStepIndex + 1] ?? null)
      : null
  const stepProgress =
    currentVisibleStepIndex >= 0
      ? Math.round(((currentVisibleStepIndex + 1) / Math.max(visibleRegisterSteps.length, 1)) * 100)
      : 0
  const [animatedStepProgress, setAnimatedStepProgress] = React.useState(stepProgress)
  const animatedStepProgressRef = React.useRef(stepProgress)

  React.useEffect(() => {
    const start = animatedStepProgressRef.current
    const target = stepProgress
    if (start === target) return

    const startTime = performance.now()
    const durationMs = 420
    let frameId = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs)
      const eased = 1 - (1 - t) ** 3
      const next = Math.round(start + (target - start) * eased)
      animatedStepProgressRef.current = next
      setAnimatedStepProgress(next)
      if (t < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [stepProgress])

  const isDraftBankMobileMoney = draftBankAccount.paymentMode === "mobile_money"

  const isRegisterStepFilled = React.useCallback(
    (step: RegisterStep) => {
      const hasText = (...values: Array<string | number | null | undefined>) =>
        values.some((value) =>
          typeof value === "string"
            ? value.trim().length > 0
            : value !== null && value !== undefined && String(value).trim().length > 0
        )

      switch (step) {
        case "details":
          return (
            hasText(
              form.firstName,
              form.middleName,
              form.lastName,
              form.preferredName,
              form.branch,
              form.department,
              form.position,
              form.gender,
              form.maritalStatus,
              form.nationality,
              form.employmentType,
              form.reportsTo,
              form.employeeNo
            ) ||
            Boolean(dob) ||
            Boolean(hireDate) ||
            Boolean(probationEndDate)
          )
        case "contacts":
          return contacts.length > 0
        case "addresses":
          return addresses.length > 0
        case "relatives":
          return relatives.length > 0
        case "identifications":
          return identifications.length > 0
        case "bankAccounts":
          return bankAccounts.length > 0
        case "academic":
          return academicQualifications.length > 0
        case "professional":
          return professionalQualifications.length > 0
        case "experience":
          return experienceDetails.length > 0
        default:
          return false
      }
    },
    [
      academicQualifications.length,
      addresses.length,
      bankAccounts.length,
      contacts.length,
      dob,
      experienceDetails.length,
      form.branch,
      form.department,
      form.employeeNo,
      form.employmentType,
      form.firstName,
      form.gender,
      form.lastName,
      form.maritalStatus,
      form.middleName,
      form.nationality,
      form.position,
      form.preferredName,
      form.reportsTo,
      hireDate,
      identifications.length,
      probationEndDate,
      professionalQualifications.length,
      relatives.length,
    ]
  )

  const getStepTransitionClass = React.useCallback(
    (step: RegisterStep) => {
      if (currentStep !== step) {
        return ""
      }
      return tabDirection === "forward"
        ? "animate-in fade-in-0 slide-in-from-right-3 duration-300"
        : "animate-in fade-in-0 slide-in-from-left-3 duration-300"
    },
    [currentStep, tabDirection]
  )

  const updateField = <K extends keyof RegisterFormState>(field: K, value: RegisterFormState[K]) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const updateOnboardingField = <K extends keyof OnboardingFormState>(field: K, value: OnboardingFormState[K]) => {
    setOnboarding((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const updateInviteWorkflowAssignment = (value: string) => {
    setOnboarding((previous) => {
      if (!value || value === "none") {
        return createEmptyOnboardingForm()
      }

      return {
        ...previous,
        enabled: true,
        workflowId: value,
      }
    })
  }

  const updateShiftAssignmentField = <K extends keyof OnboardingShiftAssignmentFormState>(
    field: K,
    value: OnboardingShiftAssignmentFormState[K]
  ) => {
    setOnboarding((previous) => ({
      ...previous,
      shiftAssignment: {
        ...previous.shiftAssignment,
        [field]: value,
      },
    }))
  }

  const updateTimetableAssignmentField = <K extends keyof OnboardingTimetableAssignmentFormState>(
    field: K,
    value: OnboardingTimetableAssignmentFormState[K]
  ) => {
    setOnboarding((previous) => ({
      ...previous,
      timetableAssignment: {
        ...previous.timetableAssignment,
        [field]: value,
      },
    }))
  }

  const updateDeviceAssignmentField = <K extends keyof OnboardingDeviceAssignmentFormState>(
    field: K,
    value: OnboardingDeviceAssignmentFormState[K]
  ) => {
    setOnboarding((previous) => ({
      ...previous,
      deviceAssignment: {
        ...previous.deviceAssignment,
        [field]: value,
      },
    }))
  }

  const updateDraftContact = <K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) => {
    setDraftContact((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const updateDraftContactPhone = (nextValue: string) => {
    const digitsOnly = nextValue.replace(/\D/g, "")
    if (digitsOnly.length > 9) {
      setDraftContactPhoneError("Phone number cannot exceed 9 digits.")
      setDraftContact((previous) => ({
        ...previous,
        phoneNumber: digitsOnly.slice(0, 9),
      }))
      return
    }
    setDraftContactPhoneError("")
    setDraftContact((previous) => ({
      ...previous,
      phoneNumber: digitsOnly,
    }))
  }

  const updateInviteContact = <K extends keyof InviteContactFormState>(field: K, value: InviteContactFormState[K]) => {
    setInviteContact((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const updateInvitePhone = (nextValue: string) => {
    const digitsOnly = nextValue.replace(/\D/g, "")
    if (digitsOnly.length > 9) {
      setInvitePhoneError("Phone number cannot exceed 9 digits.")
      setInviteContact((previous) => ({
        ...previous,
        phoneNumber: digitsOnly.slice(0, 9),
      }))
      return
    }
    setInvitePhoneError("")
    setInviteContact((previous) => ({
      ...previous,
      phoneNumber: digitsOnly,
    }))
  }

  const openAddContactDialog = () => {
    setEditingContactIndex(null)
    setDraftContact({ ...EMPTY_CONTACT })
    setDraftContactPhoneError("")
    setDraftContactEmailError("")
    setIsContactDialogOpen(true)
  }

  const openEditContactDialog = (index: number) => {
    const entry = contacts[index]
    if (!entry) {
      return
    }
    setEditingContactIndex(index)
    setDraftContact({ ...entry })
    setDraftContactPhoneError("")
    setDraftContactEmailError("")
    setIsContactDialogOpen(true)
  }

  const saveDraftContact = () => {
    const normalizedPhone = draftContact.phoneNumber.trim()
    const normalizedEmail = draftContact.email.trim().toLowerCase()
    const hasExistingPrimaryWithEmailAndPhone = contacts.some(
      (contact, index) =>
        index !== editingContactIndex &&
        contact.isPrimary &&
        Boolean(contact.phoneNumber.trim()) &&
        Boolean(contact.email.trim())
    )
    const emailRequired = !hasExistingPrimaryWithEmailAndPhone

    if (emailRequired && !normalizedEmail) {
      setDraftContactEmailError("Email is required.")
      return
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setDraftContactEmailError("Enter a valid email address.")
      return
    }

    const nextValue = {
      ...draftContact,
      email: normalizedEmail,
      notes: draftContact.notes.trim(),
      phoneNumber: normalizedPhone,
    }
    setContacts((previous) =>
      editingContactIndex === null
        ? [...previous, nextValue]
        : previous.map((item, index) => (index === editingContactIndex ? nextValue : item))
    )
    setIsContactDialogOpen(false)
    setEditingContactIndex(null)
    setDraftContact({ ...EMPTY_CONTACT })
    setDraftContactPhoneError("")
    setDraftContactEmailError("")
  }

  const removeContact = (index: number) => {
    setContacts((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateDraftAddress = <K extends keyof AddressFormState>(field: K, value: AddressFormState[K]) => {
    setDraftAddress((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const addAddress = () => {
    setEditingAddressIndex(null)
    setDraftAddress({ ...EMPTY_ADDRESS })
    setIsAddressDialogOpen(true)
  }

  const openEditAddressDialog = (index: number) => {
    const entry = addresses[index]
    if (!entry) {
      return
    }
    setEditingAddressIndex(index)
    setDraftAddress({ ...entry })
    setIsAddressDialogOpen(true)
  }

  const saveDraftAddress = () => {
    setAddresses((previous) =>
      editingAddressIndex === null
        ? [...previous, { ...draftAddress }]
        : previous.map((item, index) => (index === editingAddressIndex ? { ...draftAddress } : item))
    )
    setIsAddressDialogOpen(false)
    setEditingAddressIndex(null)
    setDraftAddress({ ...EMPTY_ADDRESS })
  }

  const removeAddress = (index: number) => {
    setAddresses((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateDraftRelative = <K extends keyof RelativeFormState>(field: K, value: RelativeFormState[K]) => {
    setDraftRelative((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const addRelative = () => {
    setEditingRelativeIndex(null)
    setDraftRelative({ ...EMPTY_RELATIVE })
    setIsRelativeDialogOpen(true)
  }

  const openEditRelativeDialog = (index: number) => {
    const entry = relatives[index]
    if (!entry) {
      return
    }
    setEditingRelativeIndex(index)
    setDraftRelative({ ...entry })
    setIsRelativeDialogOpen(true)
  }

  const saveDraftRelative = () => {
    setRelatives((previous) =>
      editingRelativeIndex === null
        ? [...previous, { ...draftRelative }]
        : previous.map((item, index) => (index === editingRelativeIndex ? { ...draftRelative } : item))
    )
    setIsRelativeDialogOpen(false)
    setEditingRelativeIndex(null)
    setDraftRelative({ ...EMPTY_RELATIVE })
  }

  const removeRelative = (index: number) => {
    setRelatives((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateDraftIdentification = <K extends keyof IdentificationFormState>(
    field: K,
    value: IdentificationFormState[K]
  ) => {
    setDraftIdentification((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const addIdentification = () => {
    setEditingIdentificationIndex(null)
    setDraftIdentification({ ...EMPTY_IDENTIFICATION })
    setIsIdentificationDialogOpen(true)
  }

  const openEditIdentificationDialog = (index: number) => {
    const entry = identifications[index]
    if (!entry) {
      return
    }
    setEditingIdentificationIndex(index)
    setDraftIdentification({ ...entry })
    setIsIdentificationDialogOpen(true)
  }

  const saveDraftIdentification = () => {
    setIdentifications((previous) =>
      editingIdentificationIndex === null
        ? [...previous, { ...draftIdentification }]
        : previous.map((item, index) => (index === editingIdentificationIndex ? { ...draftIdentification } : item))
    )
    setIsIdentificationDialogOpen(false)
    setEditingIdentificationIndex(null)
    setDraftIdentification({ ...EMPTY_IDENTIFICATION })
  }

  const removeIdentification = (index: number) => {
    setIdentifications((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateDraftBankAccount = <K extends keyof BankAccountFormState>(field: K, value: BankAccountFormState[K]) => {
    setDraftBankAccount((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const setDraftBankMode = (useMobileMoney: boolean) => {
    setDraftBankAccount((previous) => {
      if (!useMobileMoney) {
        return {
          ...previous,
          paymentMode: "bank",
          mobileMoneyProvider: "none",
        }
      }

      const nextProvider =
        previous.mobileMoneyProvider && previous.mobileMoneyProvider !== "none"
          ? previous.mobileMoneyProvider
          : DEFAULT_MOBILE_MONEY_PROVIDER

      return {
        ...previous,
        paymentMode: "mobile_money",
        mobileMoneyProvider: nextProvider,
        bankName: nextProvider,
        branchName: "",
      }
    })
  }

  const addBankAccount = () => {
    setEditingBankIndex(null)
    setDraftBankAccount({ ...EMPTY_BANK_ACCOUNT })
    setIsBankDialogOpen(true)
  }

  const openEditBankDialog = (index: number) => {
    const entry = bankAccounts[index]
    if (!entry) {
      return
    }
    const nextMode =
      entry.paymentMode ?? (entry.mobileMoneyProvider && entry.mobileMoneyProvider !== "none" ? "mobile_money" : "bank")
    setEditingBankIndex(index)
    setDraftBankAccount({
      ...entry,
      paymentMode: nextMode,
      mobileMoneyProvider:
        entry.mobileMoneyProvider && entry.mobileMoneyProvider !== "none"
          ? entry.mobileMoneyProvider
          : nextMode === "mobile_money"
            ? DEFAULT_MOBILE_MONEY_PROVIDER
            : "none",
    })
    setIsBankDialogOpen(true)
  }

  const saveDraftBankAccount = () => {
    const isMobileMoneyMode = draftBankAccount.paymentMode === "mobile_money"
    const mobileMoneyProvider = isMobileMoneyMode
      ? draftBankAccount.mobileMoneyProvider && draftBankAccount.mobileMoneyProvider !== "none"
        ? draftBankAccount.mobileMoneyProvider
        : DEFAULT_MOBILE_MONEY_PROVIDER
      : "none"

    const normalizedDraft: BankAccountFormState = {
      ...draftBankAccount,
      paymentMode: isMobileMoneyMode ? "mobile_money" : "bank",
      bankName: isMobileMoneyMode ? mobileMoneyProvider : draftBankAccount.bankName,
      accountNumber: draftBankAccount.accountNumber.trim(),
      branchName: isMobileMoneyMode ? "" : draftBankAccount.branchName,
      swiftCode: draftBankAccount.swiftCode.trim(),
      mobileMoneyProvider,
    }

    setBankAccounts((previous) =>
      editingBankIndex === null
        ? [...previous, normalizedDraft]
        : previous.map((item, index) => (index === editingBankIndex ? normalizedDraft : item))
    )
    setIsBankDialogOpen(false)
    setEditingBankIndex(null)
    setDraftBankAccount({ ...EMPTY_BANK_ACCOUNT })
  }

  const removeBankAccount = (index: number) => {
    setBankAccounts((previous) => previous.filter((_, currentIndex) => currentIndex !== index))
  }

  // Academic helpers
  const updateDraftAcademic = <K extends keyof AcademicQualificationFormState>(
    key: K,
    value: AcademicQualificationFormState[K]
  ) => {
    setDraftAcademic((previous) => ({ ...previous, [key]: value }))
  }
  const addAcademic = () => {
    setDraftAcademic({ ...EMPTY_ACADEMIC })
    setEditingAcademicIndex(null)
    setIsAcademicDialogOpen(true)
  }
  const openEditAcademic = (index: number) => {
    const entry = academicQualifications[index]
    if (!entry) return
    setDraftAcademic({ ...entry })
    setEditingAcademicIndex(index)
    setIsAcademicDialogOpen(true)
  }
  const saveDraftAcademic = () => {
    const normalized = { ...draftAcademic }
    setAcademicQualifications((previous) =>
      editingAcademicIndex === null
        ? [...previous, normalized]
        : previous.map((item, i) => (i === editingAcademicIndex ? normalized : item))
    )
    setIsAcademicDialogOpen(false)
    setEditingAcademicIndex(null)
    setDraftAcademic({ ...EMPTY_ACADEMIC })
  }
  const removeAcademic = (index: number) => setAcademicQualifications((p) => p.filter((_, i) => i !== index))

  // Professional helpers
  const updateDraftProfessional = <K extends keyof ProfessionalQualificationFormState>(
    key: K,
    value: ProfessionalQualificationFormState[K]
  ) => {
    setDraftProfessional((previous) => ({ ...previous, [key]: value }))
  }
  const addProfessional = () => {
    setDraftProfessional({ ...EMPTY_PROFESSIONAL })
    setEditingProfessionalIndex(null)
    setIsProfessionalDialogOpen(true)
  }
  const openEditProfessional = (index: number) => {
    const entry = professionalQualifications[index]
    if (!entry) return
    setDraftProfessional({ ...entry })
    setEditingProfessionalIndex(index)
    setIsProfessionalDialogOpen(true)
  }
  const saveDraftProfessional = () => {
    const normalized = { ...draftProfessional }
    setProfessionalQualifications((previous) =>
      editingProfessionalIndex === null
        ? [...previous, normalized]
        : previous.map((item, i) => (i === editingProfessionalIndex ? normalized : item))
    )
    setIsProfessionalDialogOpen(false)
    setEditingProfessionalIndex(null)
    setDraftProfessional({ ...EMPTY_PROFESSIONAL })
  }
  const removeProfessional = (index: number) => setProfessionalQualifications((p) => p.filter((_, i) => i !== index))

  // Experience helpers
  const updateDraftExperience = <K extends keyof ExperienceDetailFormState>(
    key: K,
    value: ExperienceDetailFormState[K]
  ) => {
    setDraftExperience((previous) => ({ ...previous, [key]: value }))
  }
  const addExperience = () => {
    setDraftExperience({ ...EMPTY_EXPERIENCE })
    setEditingExperienceIndex(null)
    setIsExperienceDialogOpen(true)
  }
  const openEditExperience = (index: number) => {
    const entry = experienceDetails[index]
    if (!entry) return
    setDraftExperience({ ...entry })
    setEditingExperienceIndex(index)
    setIsExperienceDialogOpen(true)
  }
  const saveDraftExperience = () => {
    const normalized = { ...draftExperience }
    setExperienceDetails((previous) =>
      editingExperienceIndex === null
        ? [...previous, normalized]
        : previous.map((item, i) => (i === editingExperienceIndex ? normalized : item))
    )
    setIsExperienceDialogOpen(false)
    setEditingExperienceIndex(null)
    setDraftExperience({ ...EMPTY_EXPERIENCE })
  }
  const removeExperience = (index: number) => setExperienceDetails((p) => p.filter((_, i) => i !== index))

  const requestDelete = (kind: DeleteEntityKind, index: number, label: string) => {
    setPendingDelete({ kind, index, label })
  }

  const confirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    const { kind, index } = pendingDelete
    if (kind === "contact") {
      removeContact(index)
    } else if (kind === "address") {
      removeAddress(index)
    } else if (kind === "relative") {
      removeRelative(index)
    } else if (kind === "identification") {
      removeIdentification(index)
    } else if (kind === "bankAccount") {
      removeBankAccount(index)
    } else if (kind === "academic") {
      removeAcademic(index)
    } else if (kind === "professional") {
      removeProfessional(index)
    } else if (kind === "experience") {
      removeExperience(index)
    }

    setPendingDelete(null)
  }

  const loadRoles = React.useCallback(async () => {
    const accessToken = resolveAccessTokenFromStorage()
    if (!accessToken) {
      setRoles([])
      setRolesError("Please login again to load roles.")
      return
    }

    setRolesLoading(true)
    setRolesError(null)
    try {
      const [
        roleRecordsResult,
        branchResult,
        departmentResult,
        positionResult,
        employeesResult,
        workflowResult,
        shiftResult,
        rotationGroupsResult,
        timetableResult,
        accessGroupsResult,
        accessOrganizationsResult,
        devicesResult,
      ] = await Promise.allSettled([
        fetchRolesDirect(accessToken),
        listBranches(accessToken, { page: 1, limit: 100 }),
        listDepartments(accessToken, { page: 1, limit: 100 }),
        listPositions(accessToken, { page: 1, limit: 100 }),
        listEmployees(accessToken, {
          page: 1,
          limit: 200,
          sortBy: "first_name",
          sortOrder: "ASC",
        }),
        listOnboardingWorkflows(accessToken, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        listShiftResources(accessToken, "shifts", {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        listShiftResources(accessToken, "shift-rotation-groups", {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        listTimetableResources(accessToken, "timetables", {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        listAccessControlResources(accessToken, "groups", {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        listAccessControlResources(accessToken, "organizations", {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        listAttendanceDevices(accessToken, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
      ])
      const roleRecords = roleRecordsResult.status === "fulfilled" ? roleRecordsResult.value : ([] as AdminRecord[])
      const resolvedBranches = branchResult.status === "fulfilled" ? branchResult.value.rows : []
      const resolvedDepartments = departmentResult.status === "fulfilled" ? departmentResult.value.rows : []
      const resolvedPositions = positionResult.status === "fulfilled" ? positionResult.value.rows : []
      const resolvedReportsTo = employeesResult.status === "fulfilled" ? employeesResult.value.rows : []
      const resolvedWorkflows = workflowResult.status === "fulfilled" ? workflowResult.value.rows : []
      const resolvedShifts = shiftResult.status === "fulfilled" ? shiftResult.value.rows : []
      const resolvedRotationGroups = rotationGroupsResult.status === "fulfilled" ? rotationGroupsResult.value.rows : []
      const resolvedTimetables = timetableResult.status === "fulfilled" ? timetableResult.value.rows : []
      const resolvedAccessGroups = accessGroupsResult.status === "fulfilled" ? accessGroupsResult.value.rows : []
      const resolvedAccessOrganizations =
        accessOrganizationsResult.status === "fulfilled" ? accessOrganizationsResult.value.rows : []
      const resolvedDevices = devicesResult.status === "fulfilled" ? devicesResult.value.rows : []
      const roleOptions = roleRecords
        .map((record) => toRoleOption(record))
        .filter((entry): entry is RoleOption => Boolean(entry))
      setRoles(roleOptions)
      setBranchRecords(resolvedBranches)
      setDepartmentRecords(resolvedDepartments)
      setPositionRecords(resolvedPositions)
      setReportsToRecords(resolvedReportsTo)
      setOnboardingWorkflows(resolvedWorkflows)
      setShiftRecords(resolvedShifts)
      setRotationGroupRecords(resolvedRotationGroups)
      setTimetableRecords(resolvedTimetables)
      setAccessGroupRecords(resolvedAccessGroups)
      setAccessOrganizationRecords(resolvedAccessOrganizations)
      setAttendanceDeviceRecords(resolvedDevices)
      if (roleOptions.length === 0) {
        setRolesError("Roles are unavailable for this account. You can still continue.")
      }
      const defaultRoleId = resolveDefaultRoleId(roleOptions)
      setForm((previous) => {
        const hasCurrent = roleOptions.some((role) => role.id === previous.roleId)
        if (hasCurrent) {
          return previous
        }
        return {
          ...previous,
          roleId: defaultRoleId,
        }
      })
    } catch (errorObject) {
      setRoles([])
      setRolesError(errorObject instanceof Error ? errorObject.message : "Failed to load registration data.")
    } finally {
      setRolesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  React.useEffect(() => {
    if (!actor.ready) {
      setRegistrationContextResolved(false)
      return
    }

    const accessToken = resolveAccessTokenFromStorage()
    if (!accessToken) {
      setInitializedFields(EMPTY_INITIALIZED_FIELDS)
      setIsInviteMode(false)
      setSelfRegistrationStatus("")
      setRegistrationContextResolved(true)
      return
    }

    let isActive = true

    const hydrateInitializedFields = async () => {
      setRegistrationContextResolved(false)
      const storedUser = readStoredAuthUser()
      const [currentAdminResult, currentEmployeeResult] = await Promise.allSettled([
        getCurrentAdmin(accessToken),
        getCurrentEmployee(accessToken),
      ])

      if (!isActive) {
        return
      }

      const currentAdmin = currentAdminResult.status === "fulfilled" ? currentAdminResult.value : null
      const currentEmployee = currentEmployeeResult.status === "fulfilled" ? currentEmployeeResult.value : null
      const initializationSources: [AdminRecord | null, AdminRecord | null, AdminRecord | null] = [
        currentEmployee,
        currentAdmin,
        storedUser,
      ]
      const employeeStatus =
        readString(currentEmployee, ["employment_status", "status", "employmentStatus"]) ||
        readString(storedUser, ["employment_status", "status", "employmentStatus"])
      setSelfRegistrationStatus((employeeStatus ?? "").toLowerCase())
      if (isRegisteringOthers) {
        setInitializedFields(EMPTY_INITIALIZED_FIELDS)
        setEmployeeNoTouched(false)
        setForm((previous) => ({
          ...previous,
          employeeNo: "",
          firstName: "",
          middleName: "",
          lastName: "",
          branch: "",
          department: "",
          position: "",
          roleId: previous.roleId || resolveDefaultRoleId(roles),
        }))
        setRegistrationContextResolved(true)
        return
      }

      setIsInviteMode(false)

      const nextInitializedFields = resolveInitializedRegistrationFields(initializationSources)
      const nextRoleId = roles.length > 0 ? resolveInitializedRoleId(roles, initializationSources) : ""
      const initialPrimaryContact = resolveInitialPrimaryContact(initializationSources)

      setInitializedFields({
        ...nextInitializedFields,
        roleId: nextRoleId,
      })
      setEmployeeNoTouched(false)

      setForm((previous) => ({
        ...previous,
        employeeNo: nextInitializedFields.employeeNo || previous.employeeNo,
        firstName: nextInitializedFields.firstName || previous.firstName,
        middleName: nextInitializedFields.middleName || previous.middleName,
        lastName: nextInitializedFields.lastName || previous.lastName,
        branch: nextInitializedFields.branch || previous.branch,
        department: nextInitializedFields.department || previous.department,
        position: nextInitializedFields.position || previous.position,
        profilePhotoUrl: previous.profilePhotoUrl || nextInitializedFields.profilePhotoUrl,
        roleId: nextRoleId || previous.roleId,
      }))
      if (initialPrimaryContact) {
        setContacts((previous) => (previous.length > 0 ? previous : [initialPrimaryContact]))
      }
      setRegistrationContextResolved(true)
    }

    void hydrateInitializedFields()

    return () => {
      isActive = false
    }
  }, [actor.ready, isRegisteringOthers, roles])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(REGISTER_DRAFT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredRegisterDraft
        if (parsed.form || parsed.inviteContact || parsed.contacts?.length || parsed.addresses?.length) {
          setSavedRegisterDraft(parsed)
        }
      }
    } catch {
      // ignore corrupted draft
      window.localStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY)
    } finally {
      setRegisterDraftReady(true)
    }
  }, [isRegisteringOthers])

  React.useEffect(() => {
    if (typeof window === "undefined" || !registerDraftReady || savedRegisterDraft) return
    const payload = {
      currentStep,
      isInviteMode,
      form,
      dob: dob ? dob.toISOString() : null,
      hireDate: hireDate ? hireDate.toISOString() : null,
      probationEndDate: probationEndDate ? probationEndDate.toISOString() : null,
      inviteContact,
      contacts,
      addresses,
      relatives,
      identifications,
      bankAccounts,
      academicQualifications,
      professionalQualifications,
      experienceDetails,
      onboarding,
      savedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(REGISTER_DRAFT_STORAGE_KEY, JSON.stringify(payload))
  }, [
    registerDraftReady,
    savedRegisterDraft,
    currentStep,
    isInviteMode,
    form,
    dob,
    hireDate,
    probationEndDate,
    inviteContact,
    contacts,
    addresses,
    relatives,
    identifications,
    bankAccounts,
    academicQualifications,
    professionalQualifications,
    experienceDetails,
    onboarding,
  ])

  const submitRegistration = async () => {
    if (isSubmitting) {
      return
    }
    setSubmitError(null)

    const accessToken = resolveAccessTokenFromStorage()
    if (!accessToken) {
      toast.error("Authentication required. Please login again.")
      return
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required.")
      return
    }
    if (isInviteMode && !form.middleName.trim()) {
      toast.error("Middle name is required for send invite.")
      return
    }

    const normalizedEmployeeNo = form.employeeNo.trim()
    const employeeNoForCreate = employeeNoTouched && normalizedEmployeeNo ? normalizedEmployeeNo : undefined

    if (isInviteMode && !form.branch.trim()) {
      toast.error("Branch is required for send invite.")
      return
    }

    if (!form.department.trim()) {
      setCurrentStep("details")
      toast.error("Department is required.")
      return
    }

    if (isInviteMode && !form.position.trim()) {
      toast.error("Position is required for send invite.")
      return
    }

    let normalizedContacts: Array<{
      contact_type: string
      is_primary: boolean
      phone_number: string
      email: string
      notes: string
    }> = []

    if (isInviteMode) {
      const normalizedInviteEmail = inviteContact.email.trim().toLowerCase()
      const normalizedInvitePhone = inviteContact.phoneNumber.trim()
      if (!normalizedInvitePhone) {
        toast.error("Phone number is required for send invite.")
        return
      }
      if (!normalizedInviteEmail) {
        toast.error("Email is required for send invite.")
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInviteEmail)) {
        toast.error("Enter a valid email address for send invite.")
        return
      }
      normalizedContacts = [
        {
          contact_type: "work",
          is_primary: true,
          phone_number: joinPhoneWithCountryCode(
            getDialCodeForCountry(inviteContact.countryIso),
            normalizedInvitePhone
          ),
          email: normalizedInviteEmail,
          notes: "Created from send invite flow.",
        },
      ]
    } else {
      normalizedContacts = contacts
        .map((contact) => ({
          contact_type: contact.contactType.trim() || "personal",
          is_primary: contact.isPrimary,
          phone_number: joinPhoneWithCountryCode(getDialCodeForCountry(contact.countryIso), contact.phoneNumber),
          email: contact.email.trim().toLowerCase(),
          notes: contact.notes.trim(),
        }))
        .filter((contact) => Boolean(contact.email))

      if (normalizedContacts.length === 0) {
        setCurrentStep("contacts")
        toast.error("At least one contact is required before saving employee.")
        return
      }
    }

    const normalizedAddresses = addresses
      .map((address) => ({
        address_type: address.addressType.trim() || "home",
        is_primary: address.isPrimary,
        address_line_1: address.addressLine1.trim(),
        address_line_2: address.addressLine2.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        country: address.country.trim(),
        postal_code: address.postalCode.trim(),
      }))
      .filter(
        (address) =>
          address.address_line_1 ||
          address.address_line_2 ||
          address.city ||
          address.state ||
          address.country ||
          address.postal_code ||
          address.is_primary
      )

    const normalizedRelatives = relatives
      .map((relative) => ({
        is_emergency_contact: relative.isEmergencyContact,
        is_primary: relative.isPrimary,
        full_name: relative.fullName.trim(),
        relationship: relative.relationship.trim(),
        phone: relative.phone.trim(),
        email: relative.email.trim(),
        address: relative.address.trim(),
        occupation: relative.occupation.trim(),
      }))
      .filter(
        (relative) =>
          relative.full_name ||
          relative.relationship ||
          relative.phone ||
          relative.email ||
          relative.address ||
          relative.occupation ||
          relative.is_emergency_contact ||
          relative.is_primary
      )

    const normalizedIdentifications = identifications
      .map((idDoc) => ({
        identification_type: idDoc.identificationType.trim() || "national_id",
        is_primary: idDoc.isPrimary,
        identification_number: idDoc.identificationNumber.trim(),
        issued_country: idDoc.issuedCountry.trim(),
        expiry_date: idDoc.expiryDate || "",
      }))
      .filter((idDoc) => idDoc.identification_number || idDoc.issued_country || idDoc.expiry_date || idDoc.is_primary)

    const normalizedBankAccounts = bankAccounts
      .map((bank) => ({
        is_primary: bank.isPrimary,
        bank_name: bank.bankName.trim(),
        account_name: bank.accountName.trim(),
        account_number: bank.accountNumber.trim(),
        branch_name: bank.branchName.trim(),
        swift_code: bank.swiftCode.trim(),
        mobile_money_provider: bank.mobileMoneyProvider.trim() === "none" ? "" : bank.mobileMoneyProvider.trim(),
      }))
      .filter(
        (bank) =>
          bank.bank_name ||
          bank.account_name ||
          bank.account_number ||
          bank.branch_name ||
          bank.swift_code ||
          bank.mobile_money_provider ||
          bank.is_primary
      )

    const normalizedAcademic = academicQualifications
      .map((a) => ({
        country_of_residence: a.countryOfResidence.trim(),
        education_level: a.educationLevel.trim(),
        institution_name: a.institutionName.trim(),
        degree_or_certificate: a.degreeOrCertificate.trim(),
        field_of_study: a.fieldOfStudy.trim(),
        start_date: a.startDate || undefined,
        end_date: a.endDate || undefined,
        academic_certificate_document_url: a.certificateUrl.trim() || undefined,
      }))
      .filter((a) => a.institution_name || a.degree_or_certificate || a.field_of_study)

    const normalizedProfessional = professionalQualifications
      .map((p) => ({
        country_of_residence: p.countryOfResidence.trim(),
        institution_name: p.institutionName.trim(),
        programme_name: p.programmeName.trim(),
        issuing_organization: p.issuingOrganization.trim(),
        issue_date: p.issueDate || undefined,
        expiry_date: p.expiryDate || undefined,
        professional_certificate_document_url: p.certificateUrl.trim() || undefined,
      }))
      .filter((p) => p.institution_name || p.programme_name || p.issuing_organization)

    const normalizedExperience = experienceDetails
      .map((e) => ({
        company_name: e.companyName.trim(),
        job_title: e.jobTitle.trim(),
        responsibilities_description: e.responsibilities.trim(),
        start_date: e.startDate || undefined,
        end_date: e.endDate || undefined,
        currently_working: e.currentlyWorking,
      }))
      .filter((e) => e.company_name || e.job_title)

    const selectedBranchRecordForSubmit = findRecordByName(branchRecords, form.branch)
    const selectedBranchIdForSubmit = readRecordId(selectedBranchRecordForSubmit)
    const departmentsForSubmit = (() => {
      if (selectedBranchIdForSubmit === null) {
        return departmentRecords
      }
      const matching = departmentRecords.filter((row) => relatedBranchId(row) === selectedBranchIdForSubmit)
      if (matching.length > 0) {
        return matching
      }
      return departmentRecords.filter((row) => relatedBranchId(row) === null)
    })()
    const selectedDepartmentRecordForSubmit = findRecordByName(departmentsForSubmit, form.department)
    const selectedPositionRecord =
      findRecordByName(departmentPositionRecords, form.position) ?? findRecordByName(positionRecords, form.position)
    const selectedReportsToRecord =
      findRecordByName(reportsToRecords, form.reportsTo) ||
      reportsToRecords.find((r) => String(readRecordId(r)) === String(form.reportsTo))
    const selectedBranchId = selectedBranchIdForSubmit
    const selectedDepartmentId = readRecordId(selectedDepartmentRecordForSubmit)
    const selectedPositionId = readRecordId(selectedPositionRecord)
    const selectedReportsToId =
      readRecordId(selectedReportsToRecord ?? null) ?? (form.reportsTo ? Number(form.reportsTo) || null : null)

    const { error: onboardingError, onboarding: onboardingPayload } = buildEmployeeOnboardingInput({
      enabled: onboarding.enabled,
      autoStart: onboarding.autoStart,
      workflowId: onboarding.workflowId,
      title: onboarding.title,
      description: onboarding.description,
      plannedStartDate: onboarding.plannedStartDate,
      plannedCompletionDate: onboarding.plannedCompletionDate,
      submit: onboarding.submit,
      fallbackEmployeeNo: employeeNoForCreate,
      provisioningDraft: onboarding,
    })
    if (onboardingError) {
      toast.error(onboardingError)
      return
    }

    setIsSubmitting(true)
    try {
      const employeePayload: CreateEmployeePayload = {
        employee_no: employeeNoForCreate,
        primary_branch_id: selectedBranchId ?? undefined,
        primary_department_id: selectedDepartmentId ?? undefined,
        primary_position_id: selectedPositionId ?? undefined,
        position_id: selectedPositionId ?? undefined,
        employment_status: "onboarding",
        employment_type: (form.employmentType || "full_time") as
          "full_time" | "part_time" | "contract" | "intern" | "consultant" | "temporary",
        reports_to: selectedReportsToId ?? undefined,
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        last_name: form.lastName.trim(),
        preferred_name: form.preferredName.trim() || undefined,
        gender: form.gender || undefined,
        date_of_birth: dob ? dob.toISOString().slice(0, 10) : undefined,
        marital_status: form.maritalStatus || undefined,
        nationality: form.nationality || undefined,
        profile_photo_url: form.profilePhotoUrl.trim() || undefined,
        hire_date: hireDate ? hireDate.toISOString().slice(0, 10) : undefined,
        probation_end_date: probationEndDate ? probationEndDate.toISOString().slice(0, 10) : undefined,
        departments: selectedDepartmentId
          ? [
              {
                department_id: selectedDepartmentId,
                is_primary: true,
              },
            ]
          : undefined,
        contacts: normalizedContacts,
        addresses: normalizedAddresses,
        relatives: normalizedRelatives,
        identifications: normalizedIdentifications,
        bank_accounts: normalizedBankAccounts,
        academic_qualifications: normalizedAcademic,
        professional_qualifications: normalizedProfessional,
        experience_details: normalizedExperience,
        onboarding: onboardingPayload,
        metadata: {
          branch_name: form.branch || undefined,
          department_name: form.department || undefined,
          position_name: form.position || undefined,
          role_id: form.roleId || undefined,
          registration_mode: isInviteMode ? "send_invite" : "full_registration",
        },
      }
      const response = isRegisteringOthers
        ? await createEmployeeProfile(accessToken, employeePayload)
        : await updateMyEmployeeProfile(accessToken, {
            first_name: employeePayload.first_name,
            middle_name: employeePayload.middle_name,
            last_name: employeePayload.last_name,
            preferred_name: employeePayload.preferred_name,
            gender: employeePayload.gender,
            date_of_birth: employeePayload.date_of_birth,
            marital_status: employeePayload.marital_status,
            nationality: employeePayload.nationality,
            profile_photo_url: employeePayload.profile_photo_url,
            contacts: employeePayload.contacts,
            addresses: employeePayload.addresses,
            relatives: employeePayload.relatives,
            identifications: employeePayload.identifications,
            bank_accounts: employeePayload.bank_accounts,
            academic_qualifications: employeePayload.academic_qualifications,
            professional_qualifications: employeePayload.professional_qualifications,
            experience_details: employeePayload.experience_details,
            metadata: employeePayload.metadata,
          })
      const normalizedResponse = response as CreateEmployeeResponse
      if (!isRegisteringOthers) {
        const myRequests = await listMyOnboardingRequests(accessToken)
        const draftRequest = myRequests.find((row) =>
          ["draft", "changes_requested"].includes(String(row.status ?? "").toLowerCase())
        )
        const draftRequestId = readRecordId(draftRequest ?? null)
        if (draftRequestId !== null) {
          await submitMyOnboardingDetails(accessToken, draftRequestId)
        }
      }
      const createdEmployeeId = readRecordId(normalizedResponse)
      let onboardingRequest = normalizedResponse.onboarding_request ?? null
      if (!onboardingRequest && createdEmployeeId !== null && isRegisteringOthers) {
        const selectedWorkflowId =
          onboarding.workflowId && onboarding.workflowId !== "none" ? Number(onboarding.workflowId) : null
        const defaultWorkflow =
          onboardingWorkflows.find((row) => row.is_default === true || row.isDefault === true) ??
          onboardingWorkflows[0] ??
          null
        const defaultWorkflowId = defaultWorkflow ? readRecordId(defaultWorkflow) : null
        const workflowId =
          selectedWorkflowId && Number.isFinite(selectedWorkflowId) && selectedWorkflowId > 0
            ? selectedWorkflowId
            : defaultWorkflowId
        const employeeName = [form.firstName, form.middleName, form.lastName]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(" ")
        try {
          onboardingRequest = await ensureDraftOnboardingRequest(accessToken, {
            employee_id: createdEmployeeId,
            workflow_id: workflowId ?? undefined,
            title: employeeName ? `Onboarding for ${employeeName}` : "Onboarding",
          })
        } catch (onboardingError) {
          toast.message(
            onboardingError instanceof Error
              ? `Employee saved, but onboarding could not be started. ${onboardingError.message}`
              : "Employee saved, but onboarding could not be started from this page."
          )
        }
      }
      if (onboardingRequest && onboardingPayload?.submit) {
        const onboardingRequestId = readRecordId(onboardingRequest)
        void notifySubmittedRequestApprovers({
          kind: "onboarding_request",
          token: accessToken,
          request: onboardingRequest,
          requesterName: [form.firstName, form.middleName, form.lastName]
            .map((value) => value.trim())
            .filter(Boolean)
            .join(" "),
          loadRequest:
            onboardingRequestId === null ? undefined : () => getOnboardingRequest(accessToken, onboardingRequestId),
        })
      }
      setCreatedEmployeeResult({
        ...normalizedResponse,
        onboarding_request: onboardingRequest ?? normalizedResponse.onboarding_request,
      })
      const createWarning = typeof normalizedResponse.warning === "string" ? normalizedResponse.warning.trim() : ""
      showSuccessAlert(
        !isRegisteringOthers
          ? "Your details were submitted to HR for review."
          : createWarning
            ? `Employee saved. ${createWarning}`
            : onboardingRequest
              ? onboardingPayload?.submit
                ? "Employee created and onboarding started."
                : "Employee saved. Onboarding is listed as a draft request."
              : isInviteMode
                ? "Employee invite saved successfully."
                : "Employee saved successfully."
      )
      clearForm()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to save employee."
      setSubmitError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearForm = () => {
    setCurrentStep("details")
    setForm({
      ...EMPTY_FORM,
      roleId: resolveDefaultRoleId(roles),
      employmentType: "full_time",
      reportsTo: "",
    })
    setIsInviteMode(false)
    setInviteContact({ ...EMPTY_INVITE_CONTACT })
    setInvitePhoneError("")
    setInviteEmailError("")
    setDob(undefined)
    setContacts([])
    setAddresses([])
    setRelatives([])
    setIdentifications([])
    setBankAccounts([])
    setAcademicQualifications([])
    setProfessionalQualifications([])
    setExperienceDetails([])
    setHireDate(undefined)
    setProbationEndDate(undefined)
    setDraftContact({ ...EMPTY_CONTACT })
    setDraftContactPhoneError("")
    setDraftContactEmailError("")
    setIsContactDialogOpen(false)
    setEditingContactIndex(null)
    setDraftAddress({ ...EMPTY_ADDRESS })
    setIsAddressDialogOpen(false)
    setEditingAddressIndex(null)
    setDraftRelative({ ...EMPTY_RELATIVE })
    setIsRelativeDialogOpen(false)
    setEditingRelativeIndex(null)
    setDraftIdentification({ ...EMPTY_IDENTIFICATION })
    setIsIdentificationDialogOpen(false)
    setEditingIdentificationIndex(null)
    setDraftBankAccount({ ...EMPTY_BANK_ACCOUNT })
    setIsBankDialogOpen(false)
    setDraftAcademic({ ...EMPTY_ACADEMIC })
    setIsAcademicDialogOpen(false)
    setEditingAcademicIndex(null)
    setDraftProfessional({ ...EMPTY_PROFESSIONAL })
    setIsProfessionalDialogOpen(false)
    setEditingProfessionalIndex(null)
    setDraftExperience({ ...EMPTY_EXPERIENCE })
    setIsExperienceDialogOpen(false)
    setEditingExperienceIndex(null)
    setEditingBankIndex(null)
    setOnboarding(createEmptyOnboardingForm())
    setPendingDelete(null)
    setSubmitError(null)
    setEmployeeNoTouched(false)
    setSavedRegisterDraft(null)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY)
    }
    toast.message("Form reset.")
  }

  const resumeRegisterDraft = () => {
    const draft = savedRegisterDraft
    if (!draft) return

    if (draft.currentStep && REGISTER_STEP_ORDER.includes(draft.currentStep)) {
      setCurrentStep(draft.currentStep)
    }
    if (draft.isInviteMode !== undefined) {
      setIsInviteMode(draft.isInviteMode)
    }
    if (draft.form) {
      const { employeeNo: draftEmployeeNo, ...restForm } = draft.form
      setForm((previous) => ({
        ...previous,
        ...restForm,
        employeeNo: isRegisteringOthers ? "" : (draftEmployeeNo ?? previous.employeeNo),
      }))
    }
    if (draft.inviteContact) {
      setInviteContact((previous) => ({ ...previous, ...draft.inviteContact }))
    }

    const restoreDate = (value: string | null | undefined, setter: (date: Date | undefined) => void) => {
      if (!value) return
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) setter(date)
    }
    restoreDate(draft.dob, setDob)
    restoreDate(draft.hireDate, setHireDate)
    restoreDate(draft.probationEndDate, setProbationEndDate)
    if (Array.isArray(draft.contacts)) setContacts(draft.contacts)
    if (Array.isArray(draft.addresses)) setAddresses(draft.addresses)
    if (Array.isArray(draft.relatives)) setRelatives(draft.relatives)
    if (Array.isArray(draft.identifications)) setIdentifications(draft.identifications)
    if (Array.isArray(draft.bankAccounts)) setBankAccounts(draft.bankAccounts)
    if (Array.isArray(draft.academicQualifications)) setAcademicQualifications(draft.academicQualifications)
    if (Array.isArray(draft.professionalQualifications)) setProfessionalQualifications(draft.professionalQualifications)
    if (Array.isArray(draft.experienceDetails)) setExperienceDetails(draft.experienceDetails)
    const draftOnboarding = draft.onboarding
    if (draftOnboarding) {
      setOnboarding((previous) => ({
        ...previous,
        ...draftOnboarding,
        shiftAssignment: {
          ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT,
          ...draftOnboarding.shiftAssignment,
        },
        timetableAssignment: {
          ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT,
          ...draftOnboarding.timetableAssignment,
        },
        deviceAssignment: {
          ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT,
          ...draftOnboarding.deviceAssignment,
          employeeNo: isRegisteringOthers ? "" : (draftOnboarding.deviceAssignment?.employeeNo ?? ""),
          deviceIds: Array.isArray(draftOnboarding.deviceAssignment?.deviceIds)
            ? draftOnboarding.deviceAssignment.deviceIds
            : [],
        },
      }))
    }
    setSavedRegisterDraft(null)
  }

  const discardRegisterDraft = () => {
    setSavedRegisterDraft(null)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY)
    }
  }

  if (!registrationContextResolved) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-4">
        <p className="text-sm font-medium text-foreground">Loading registration</p>
        <p className="mt-1 text-xs text-muted-foreground">Checking your registration access...</p>
      </div>
    )
  }

  if (!isRegisteringOthers && actor.accessMode === "employee" && selfRegistrationStatus !== "onboarding") {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-4">
        <p className="text-sm font-medium text-foreground">Self registration unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This page is available only while your employee status is onboarding.
        </p>
      </div>
    )
  }

  if (!isRegisteringOthers && actor.accessMode !== "employee") {
    return null
  }

  return (
    <div className="space-y-2">
      {savedRegisterDraft ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Continue where you left off?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
            <p className="text-xs text-muted-foreground">
              {savedRegisterDraft.form?.firstName || savedRegisterDraft.form?.lastName
                ? `You have an unfinished registration for ${[savedRegisterDraft.form.firstName, savedRegisterDraft.form.lastName].filter(Boolean).join(" ")}.`
                : "You have an unfinished employee registration."}
              {savedRegisterDraft.savedAt ? ` Saved ${new Date(savedRegisterDraft.savedAt).toLocaleString()}.` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={discardRegisterDraft}>
                Start fresh
              </Button>
              <Button type="button" size="sm" onClick={resumeRegisterDraft}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {submitError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}
      <div className="animate-card-entrance overflow-visible rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
        <Tabs
          value={currentStep}
          onValueChange={(value) => {
            if (REGISTER_STEP_ORDER.includes(value as RegisterStep)) {
              const nextStep = value as RegisterStep
              const nextIndex = REGISTER_STEP_ORDER.indexOf(nextStep)
              if (nextIndex !== -1 && nextIndex !== currentStepIndex) {
                setTabDirection(nextIndex > currentStepIndex ? "forward" : "backward")
              }
              setCurrentStep(nextStep)
            }
          }}
        >
          <div className="space-y-1.5 border-b border-border px-3 pt-3 pb-0 sm:px-4">
            {!isInviteMode ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Step {Math.max(currentVisibleStepIndex + 1, 1)} of {visibleRegisterSteps.length}
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  <span className="text-foreground">{REGISTER_STEP_LABELS[currentStep] ?? "Details"}</span>
                </p>
                <p
                  key={stepProgress}
                  className="text-sm font-semibold tabular-nums tracking-tight text-[var(--primary)] animate-fade-up"
                  aria-label={`Registration progress ${animatedStepProgress} percent`}
                >
                  {animatedStepProgress}%
                </p>
              </div>
            ) : null}

            <div className="glass-scrollbar -mx-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
              <TabsList className="inline-flex h-auto min-w-full items-center gap-0.5 rounded-none border-0 border-b border-border/80 bg-transparent p-0">
                {visibleRegisterSteps.map((step, index) => {
                  const isActive = currentStep === step
                  const isVisited = currentVisibleStepIndex >= index
                  const hasData = isRegisterStepFilled(step)
                  const isEmptyVisited = isVisited && !hasData
                  const isFilledVisited = isVisited && hasData
                  return (
                    <TabsTrigger
                      key={step}
                      value={step}
                      className={cn(
                        "h-auto shrink-0 rounded-none border-0 border-b-2 bg-transparent px-2 py-1.5 text-xs font-medium whitespace-nowrap shadow-none transition-colors",
                        "data-active:bg-transparent data-active:shadow-none",
                        isActive && hasData
                          ? "border-[var(--primary)] text-[var(--primary)]"
                          : isActive && !hasData
                            ? "border-rose-500 text-rose-600"
                            : isEmptyVisited
                              ? "border-transparent text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                              : isFilledVisited
                                ? "border-transparent text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "mr-1.5 inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold leading-none",
                          isActive && hasData
                            ? "bg-[var(--primary)] !text-white"
                            : isActive && !hasData
                              ? "bg-rose-500 text-white"
                              : isEmptyVisited
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                                : isFilledVisited
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : "bg-muted text-muted-foreground"
                        )}
                      >
                        {index + 1}
                      </span>
                      {REGISTER_STEP_LABELS[step]}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </div>
          </div>

          <div className="space-y-3 px-3 py-3 sm:px-4">
            <TabsContents className="[&_[data-slot=input]]:h-9 [&_[data-slot=input]]:px-3 [&_[data-slot=select-trigger]]:h-9 [&_[data-slot=select-trigger]]:px-3 [&_[data-slot=select-content]]:p-1 [&_[data-slot=select-item]]:px-2.5 [&_[data-slot=select-item]]:py-1.5">
              <TabsContent value="details" className={getStepTransitionClass("details")}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Field
                    label="Employee Number (Optional)"
                    htmlFor="employeeNo"
                    delayMs={30}
                    hint="Leave blank to auto-assign the next unused number."
                  >
                    <Input
                      id="employeeNo"
                      name="hrms-new-employee-number"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={form.employeeNo}
                      onChange={(event) => {
                        setEmployeeNoTouched(true)
                        updateField("employeeNo", event.target.value)
                      }}
                      placeholder="Leave blank to auto-assign"
                      disabled={lockedFields.employeeNo}
                    />
                  </Field>

                  <Field label="First Name" htmlFor="firstName" delayMs={40}>
                    <Input
                      id="firstName"
                      value={form.firstName}
                      onChange={(event) => updateField("firstName", event.target.value)}
                      placeholder="Enter first name"
                    />
                  </Field>

                  <Field
                    label={isInviteMode ? "Middle Name" : "Middle Name"}
                    htmlFor="middleName"
                    delayMs={80}
                    hint={isInviteMode ? "Required in send invite mode." : undefined}
                    reserveHintSpace={isInviteMode}
                  >
                    <Input
                      id="middleName"
                      value={form.middleName}
                      onChange={(event) => updateField("middleName", event.target.value)}
                      placeholder="Enter middle name"
                    />
                  </Field>

                  <Field label="Last Name" htmlFor="lastName" delayMs={120}>
                    <Input
                      id="lastName"
                      value={form.lastName}
                      onChange={(event) => updateField("lastName", event.target.value)}
                      placeholder="Enter last name"
                    />
                  </Field>

                  <Field label="Branch" htmlFor="branch" delayMs={160}>
                    {lockedFields.branch ? (
                      <Input id="branch" value={form.branch} disabled />
                    ) : (
                      <Select
                        value={form.branch}
                        onValueChange={(value) => {
                          updateField("branch", value ?? "")
                          updateField("department", "")
                          updateField("position", "")
                        }}
                      >
                        <SelectTrigger id="branch" className="w-full">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branchOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>

                  <Field label="Department" htmlFor="department" delayMs={200}>
                    {lockedFields.department ? (
                      <Input id="department" value={form.department} disabled />
                    ) : (
                      <Select
                        value={form.department}
                        onValueChange={(value) => {
                          updateField("department", value ?? "")
                          updateField("position", "")
                        }}
                        disabled={!form.branch}
                      >
                        <SelectTrigger id="department" className="w-full">
                          <SelectValue placeholder={form.branch ? "Select department" : "Select branch first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {departmentOptions.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                              {form.branch ? "No departments for this branch" : "Select a branch first"}
                            </div>
                          ) : null}
                          {departmentOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>

                  <Field label="Position" htmlFor="position" delayMs={240}>
                    {lockedFields.position ? (
                      <Input id="position" value={form.position} disabled />
                    ) : (
                      <Select
                        value={form.position}
                        onValueChange={(value) => updateField("position", value ?? "")}
                        disabled={!form.department || departmentPositionsLoading}
                      >
                        <SelectTrigger id="position" className="w-full">
                          <SelectValue
                            placeholder={
                              !form.department
                                ? "Select department first"
                                : departmentPositionsLoading
                                  ? "Loading positions..."
                                  : "Select position"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {positionOptions.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                              {!form.department
                                ? "Select a department first"
                                : departmentPositionsLoading
                                  ? "Loading positions..."
                                  : "No positions for this department"}
                            </div>
                          ) : null}
                          {positionOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>

                  <Field label="Reports To" htmlFor="reportsTo" delayMs={255}>
                    <Select value={form.reportsTo} onValueChange={(value) => updateField("reportsTo", value ?? "")}>
                      <SelectTrigger id="reportsTo" className="w-full">
                        <SelectValue placeholder="Select manager (optional)">
                          {form.reportsTo ? selectedReportsToLabel || "Selected manager" : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— None —</SelectItem>
                        {reportsToOptions.map((opt) => (
                          <SelectItem key={opt.id} value={String(opt.id)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Employment Type" htmlFor="employmentType" delayMs={258}>
                    <Select
                      value={form.employmentType || "full_time"}
                      onValueChange={(value) =>
                        updateField(
                          "employmentType",
                          (value ?? "full_time") as EmploymentType,
                        )
                      }
                    >
                      <SelectTrigger id="employmentType" className="w-full">
                        <SelectValue>{selectedEmploymentTypeLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPE_OPTIONS.map((et) => (
                          <SelectItem key={et.value} value={et.value}>
                            {et.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Preferred Name" htmlFor="preferredName" delayMs={260}>
                    <Input
                      id="preferredName"
                      value={form.preferredName}
                      onChange={(event) => updateField("preferredName", event.target.value)}
                      placeholder="Preferred / display name"
                    />
                  </Field>

                  <Field label="Hire Date" htmlFor="hire-date" delayMs={265}>
                    <DatePickerPresets
                      value={hireDate ? hireDate.toISOString().slice(0, 10) : ""}
                      onChange={(v) => setHireDate(v ? new Date(v) : undefined)}
                      placeholder="Select hire date"
                    />
                  </Field>

                  <Field label="Probation End Date" htmlFor="probation-date" delayMs={268}>
                    <DatePickerPresets
                      value={probationEndDate ? probationEndDate.toISOString().slice(0, 10) : ""}
                      onChange={(v) => setProbationEndDate(v ? new Date(v) : undefined)}
                      placeholder="Select probation end date"
                    />
                  </Field>

                  {isInviteMode ? (
                    <>
                      <Field
                        label="Onboarding workflow"
                        htmlFor="invite-workflow"
                        delayMs={260}
                        hint="Select an onboarding workflow to start for this invite."
                        reserveHintSpace
                      >
                        <Select
                          value={onboarding.enabled ? onboarding.workflowId || "none" : "none"}
                          onValueChange={(value) => updateInviteWorkflowAssignment(value ?? "none")}
                        >
                          <SelectTrigger id="invite-workflow" className="w-full">
                            <SelectValue placeholder="Select workflow assignment">
                              {onboarding.enabled && onboarding.workflowId && onboarding.workflowId !== "none"
                                ? onboardingWorkflowOptions.find(
                                    (option) => String(option.id) === String(onboarding.workflowId)
                                  )?.label || "Selected workflow"
                                : "No workflow assigned"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No workflow assigned</SelectItem>
                            {onboardingWorkflowOptions.map((option) => (
                              <SelectItem key={option.id} value={String(option.id)}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Phone Country" htmlFor="invite-country" delayMs={260}>
                        <Select
                          value={inviteContact.countryIso}
                          onValueChange={(value) => updateInviteContact("countryIso", value as CountryIso)}
                        >
                          <SelectTrigger id="invite-country" className="w-full">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(COUNTRY_LABELS).map(([isoCode, label]) => (
                              <SelectItem key={isoCode} value={isoCode}>
                                {label.primary} ({label.secondary})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field
                        label="Phone Number"
                        htmlFor="invite-phone"
                        delayMs={280}
                        hint={invitePhoneError || "Required for send invite."}
                        reserveHintSpace
                      >
                        <Input
                          id="invite-phone"
                          inputMode="numeric"
                          value={inviteContact.phoneNumber}
                          onChange={(event) => updateInvitePhone(event.target.value)}
                          placeholder="Enter phone number"
                        />
                      </Field>

                      <Field
                        label="Email"
                        htmlFor="invite-email"
                        delayMs={300}
                        hint={inviteEmailError || "Required for send invite."}
                        reserveHintSpace
                      >
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteContact.email}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            setInviteEmailError("")
                            updateInviteContact("email", nextValue)
                          }}
                          placeholder="Enter email address"
                        />
                      </Field>
                    </>
                  ) : null}

                  {!isInviteMode ? (
                    <>
                      <Field label="Gender" htmlFor="gender" delayMs={280}>
                        <Select value={form.gender} onValueChange={(value) => updateField("gender", value ?? "")}>
                          <SelectTrigger id="gender" className="w-full">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            {GENDER_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Marital Status" htmlFor="maritalStatus" delayMs={320}>
                        <Select
                          value={form.maritalStatus}
                          onValueChange={(value) => updateField("maritalStatus", value ?? "")}
                        >
                          <SelectTrigger id="maritalStatus" className="w-full">
                            <SelectValue placeholder="Select marital status" />
                          </SelectTrigger>
                          <SelectContent>
                            {MARITAL_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Nationality" htmlFor="nationality" delayMs={360}>
                        <Select
                          value={form.nationality || ""}
                          onValueChange={(value) => updateField("nationality", value ?? "")}
                        >
                          <SelectTrigger id="nationality" className="w-full">
                            <SelectValue placeholder="Select nationality">
                              {form.nationality ? (
                                <span className="flex min-w-0 items-center gap-2">
                                  <NationalityFlag code={form.nationality} />
                                  <span className="truncate">{countryNameFromIso(form.nationality)}</span>
                                </span>
                              ) : undefined}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-64" align="start">
                            {NATIONALITY_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.code}
                                value={option.code}
                                data-search-text={`${option.name} ${option.code}`}
                                className="py-1.5"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <NationalityFlag code={option.code} />
                                  <span className="truncate">{option.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <AnimatedField delayMs={440}>
                        <div className="grid gap-2 md:col-span-2 xl:col-span-3">
                          <Label htmlFor="dob-trigger">Date of Birth</Label>
                          <DateInput
                            id="dob-trigger"
                            className="max-w-none"
                            value={dob ? dob.toISOString().slice(0, 10) : ""}
                            max={new Date().toISOString().slice(0, 10)}
                            placeholder="Select date from calendar"
                            onValueChange={(value) =>
                              setDob(value ? new Date(`${value}T12:00:00`) : undefined)
                            }
                          />
                        </div>
                      </AnimatedField>
                    </>
                  ) : null}
                </div>

                {isRegisteringOthers && !isInviteMode ? (
                  <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">Optional onboarding</h3>
                        <InfoTooltip
                          label="About optional onboarding"
                          content="Configure onboarding workflow and provisioning once during employee registration."
                        />
                      </div>
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                        <Switch
                          checked={onboarding.enabled}
                          onCheckedChange={(checked) =>
                            setOnboarding((previous) => ({
                              ...(checked ? previous : createEmptyOnboardingForm()),
                              enabled: checked,
                            }))
                          }
                        />
                        <span className="text-sm font-medium text-foreground">Enable</span>
                      </div>
                    </div>

                    {onboarding.enabled ? (
                      <div className="mt-5 space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Onboarding workflow" htmlFor="onboarding-workflow" delayMs={30}>
                            <Select
                              value={onboarding.workflowId}
                              onValueChange={(value) => updateOnboardingField("workflowId", value ?? "")}
                            >
                              <SelectTrigger id="onboarding-workflow" className="w-full">
                                <SelectValue placeholder="Select workflow">
                                  {onboarding.workflowId && onboarding.workflowId !== "none"
                                    ? onboardingWorkflowOptions.find(
                                        (option) => String(option.id) === String(onboarding.workflowId)
                                      )?.label || "Selected workflow"
                                    : "No workflow"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No workflow</SelectItem>
                                {onboardingWorkflowOptions.map((option) => (
                                  <SelectItem key={option.id} value={String(option.id)}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field label="Onboarding Title" htmlFor="onboarding-title" delayMs={50}>
                            <Input
                              id="onboarding-title"
                              value={onboarding.title}
                              onChange={(event) => updateOnboardingField("title", event.target.value)}
                              placeholder="Default title is fine if left blank"
                            />
                          </Field>

                          <Field label="Planned Start Date" htmlFor="onboarding-start-date" delayMs={60}>
                            <DateInput
                              id="onboarding-start-date"

                              value={onboarding.plannedStartDate}
                              onChange={(event) => updateOnboardingField("plannedStartDate", event.target.value)}
                            />
                          </Field>

                          <Field label="Planned Completion Date" htmlFor="onboarding-end-date" delayMs={70}>
                            <DateInput
                              id="onboarding-end-date"

                              value={onboarding.plannedCompletionDate}
                              onChange={(event) => updateOnboardingField("plannedCompletionDate", event.target.value)}
                            />
                          </Field>

                          <div className="grid gap-2">
                            <Label>Start onboarding automatically</Label>
                            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">Auto-start onboarding request</p>
                                <InfoTooltip
                                  label="Auto-start onboarding help"
                                  content="Creates the onboarding request during employee registration."
                                />
                              </div>
                              <Switch
                                checked={onboarding.autoStart}
                                onCheckedChange={(checked) => updateOnboardingField("autoStart", checked)}
                              />
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Label>Submit immediately</Label>
                            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">Submit onboarding after creation</p>
                                <InfoTooltip
                                  label="Submit immediately help"
                                  content="Leave this off unless the workflow already has eligible approvers on every required step. Turned off, the employee is saved and onboarding stays a draft."
                                />
                              </div>
                              <Switch
                                checked={onboarding.submit}
                                onCheckedChange={(checked) => updateOnboardingField("submit", checked)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="onboarding-description">Description</Label>
                          <Textarea
                            id="onboarding-description"
                            className="min-h-24 rounded-md border border-input bg-card px-3 py-2 text-sm"
                            value={onboarding.description}
                            onChange={(event) => updateOnboardingField("description", event.target.value)}
                            placeholder="Add onboarding notes or instructions (optional)"
                          />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <MultiSelectChecklist
                            label="Company roles"
                            options={onboardingRoleOptions}
                            selectedIds={onboarding.roleIds}
                            onToggle={(id, checked) =>
                              updateOnboardingField("roleIds", toggleNumericId(onboarding.roleIds, id, checked))
                            }
                            emptyText="No roles available."
                            hint="Optional roles to provision automatically when onboarding completes."
                          />

                          <MultiSelectChecklist
                            label="Branch access"
                            options={branchAccessOptions}
                            selectedIds={onboarding.branchAccessIds}
                            onToggle={(id, checked) =>
                              updateOnboardingField(
                                "branchAccessIds",
                                toggleNumericId(onboarding.branchAccessIds, id, checked)
                              )
                            }
                            emptyText="No branches available."
                            hint="Optional branch access assignments to attach during onboarding."
                          />
                        </div>

                        {onboarding.attendanceMode === "shift" ? (
                          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <p className="text-sm font-medium text-foreground">Shift assignment</p>
                              <p className="text-xs text-muted-foreground">
                                This section is required when attendance mode is set to shift.
                              </p>
                            </div>
                            <Field label="Shift" htmlFor="provisioning-shift" delayMs={80}>
                              <Select
                                value={onboarding.shiftAssignment.shiftId || "none"}
                                onValueChange={(value) =>
                                  updateShiftAssignmentField("shiftId", value === "none" ? "" : (value ?? ""))
                                }
                              >
                                <SelectTrigger id="provisioning-shift" className="w-full">
                                  <SelectValue placeholder="Select shift" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Select shift</SelectItem>
                                  {shiftOptions.map((option) => (
                                    <SelectItem key={option.id} value={String(option.id)}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field label="Effective From" htmlFor="provisioning-shift-from" delayMs={90}>
                              <DateInput
                                id="provisioning-shift-from"

                                value={onboarding.shiftAssignment.effectiveFrom}
                                onChange={(event) => updateShiftAssignmentField("effectiveFrom", event.target.value)}
                              />
                            </Field>
                            <Field label="Effective To" htmlFor="provisioning-shift-to" delayMs={100}>
                              <DateInput
                                id="provisioning-shift-to"

                                value={onboarding.shiftAssignment.effectiveTo}
                                onChange={(event) => updateShiftAssignmentField("effectiveTo", event.target.value)}
                              />
                            </Field>
                            <Field
                              label="Rotation Group (optional)"
                              htmlFor="provisioning-rotation-group"
                              delayMs={110}
                              hint="Select a rotation group if this shift assignment uses rotations."
                              reserveHintSpace
                            >
                              <Select
                                value={onboarding.shiftAssignment.rotationGroupId || "none"}
                                onValueChange={(value) =>
                                  updateShiftAssignmentField(
                                    "rotationGroupId",
                                    (value ?? "none") === "none" ? "" : (value ?? "")
                                  )
                                }
                              >
                                <SelectTrigger id="provisioning-rotation-group" className="w-full">
                                  <SelectValue placeholder="None">
                                    {onboarding.shiftAssignment.rotationGroupId
                                      ? (rotationGroupOptions.find(
                                          (option) => String(option.id) === onboarding.shiftAssignment.rotationGroupId
                                        )?.label ?? `Rotation group #${onboarding.shiftAssignment.rotationGroupId}`)
                                      : "None"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {rotationGroupOptions.map((option) => (
                                    <SelectItem key={option.id} value={String(option.id)}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-foreground">Primary shift</p>
                                <p className="text-xs text-muted-foreground">
                                  Mark this assignment as the primary one for the employee
                                </p>
                              </div>
                              <Switch
                                checked={onboarding.shiftAssignment.isPrimary}
                                onCheckedChange={(checked) => updateShiftAssignmentField("isPrimary", checked)}
                              />
                            </div>
                          </div>
                        ) : null}

                        {onboarding.attendanceMode === "timetable" ? (
                          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <p className="text-sm font-medium text-foreground">Timetable assignment</p>
                              <p className="text-xs text-muted-foreground">
                                This section is required when attendance mode is set to timetable.
                              </p>
                            </div>
                            <Field label="Timetable" htmlFor="provisioning-timetable" delayMs={80}>
                              <Select
                                value={onboarding.timetableAssignment.timetableId || "none"}
                                onValueChange={(value) =>
                                  updateTimetableAssignmentField("timetableId", value === "none" ? "" : (value ?? ""))
                                }
                              >
                                <SelectTrigger id="provisioning-timetable" className="w-full">
                                  <SelectValue placeholder="Select timetable">
                                    {onboarding.timetableAssignment.timetableId
                                      ? timetableOptions.find(
                                          (option) =>
                                            String(option.id) === String(onboarding.timetableAssignment.timetableId)
                                        )?.label || "Selected timetable"
                                      : "Select timetable"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Select timetable</SelectItem>
                                  {timetableOptions.map((option) => (
                                    <SelectItem key={option.id} value={String(option.id)}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field label="Effective From" htmlFor="provisioning-timetable-from" delayMs={90}>
                              <DateInput
                                id="provisioning-timetable-from"

                                value={onboarding.timetableAssignment.effectiveFrom}
                                onChange={(event) =>
                                  updateTimetableAssignmentField("effectiveFrom", event.target.value)
                                }
                              />
                            </Field>
                            <Field label="Effective To" htmlFor="provisioning-timetable-to" delayMs={100}>
                              <DateInput
                                id="provisioning-timetable-to"

                                value={onboarding.timetableAssignment.effectiveTo}
                                onChange={(event) => updateTimetableAssignmentField("effectiveTo", event.target.value)}
                              />
                            </Field>
                          </div>
                        ) : null}

                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">Device and access control setup</p>
                              <p className="text-xs text-muted-foreground">
                                Enable only if this employee should get device/access provisioning during onboarding.
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-foreground">Enable</span>
                              <Switch
                                checked={onboarding.deviceAssignment.enabled}
                                onCheckedChange={(checked) =>
                                  setOnboarding((previous) => ({
                                    ...previous,
                                    deviceAssignment: checked
                                      ? {
                                          ...previous.deviceAssignment,
                                          enabled: true,
                                        }
                                      : {
                                          ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT,
                                          enabled: false,
                                        },
                                  }))
                                }
                              />
                            </div>
                          </div>

                          {onboarding.deviceAssignment.enabled ? (
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <Field label="Access Group" htmlFor="device-access-group" delayMs={110}>
                                <Select
                                  value={onboarding.deviceAssignment.accessGroupId || "none"}
                                  onValueChange={(value) =>
                                    updateDeviceAssignmentField("accessGroupId", value === "none" ? "" : (value ?? ""))
                                  }
                                >
                                  <SelectTrigger id="device-access-group" className="w-full">
                                    <SelectValue placeholder="Select access group" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Select access group</SelectItem>
                                    {accessGroupOptions.map((option) => (
                                      <SelectItem key={option.id} value={String(option.id)}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>

                              <Field label="Organization" htmlFor="device-organization" delayMs={120}>
                                <Select
                                  value={onboarding.deviceAssignment.organizationId || "none"}
                                  onValueChange={(value) =>
                                    updateDeviceAssignmentField("organizationId", value === "none" ? "" : (value ?? ""))
                                  }
                                >
                                  <SelectTrigger id="device-organization" className="w-full">
                                    <SelectValue placeholder="Select organization (optional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No organization</SelectItem>
                                    {accessOrganizationOptions.map((option) => (
                                      <SelectItem key={option.id} value={String(option.id)}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>

                              <Field label="Employee No Override" htmlFor="device-employee-no" delayMs={130}>
                                <Input
                                  id="device-employee-no"
                                  value={onboarding.deviceAssignment.employeeNo}
                                  onChange={(event) => updateDeviceAssignmentField("employeeNo", event.target.value)}
                                  placeholder="Optional override for access device employee number"
                                />
                              </Field>

                              <Field label="User Verify Mode" htmlFor="device-user-verify" delayMs={140}>
                                <Input
                                  id="device-user-verify"
                                  value={onboarding.deviceAssignment.userVerifyMode}
                                  onChange={(event) =>
                                    updateDeviceAssignmentField("userVerifyMode", event.target.value)
                                  }
                                  placeholder="Optional verify mode"
                                />
                              </Field>

                              <Field label="Valid Begin Time" htmlFor="device-valid-begin" delayMs={150}>
                                <DateTimeInput
                                  id="device-valid-begin"
                                  aria-label="Valid begin time"
                                  value={onboarding.deviceAssignment.validBeginTime}
                                  onChange={(event) =>
                                    updateDeviceAssignmentField("validBeginTime", event.target.value)
                                  }
                                />
                              </Field>

                              <Field label="Valid End Time" htmlFor="device-valid-end" delayMs={160}>
                                <DateTimeInput
                                  id="device-valid-end"
                                  aria-label="Valid end time"
                                  value={onboarding.deviceAssignment.validEndTime}
                                  onChange={(event) => updateDeviceAssignmentField("validEndTime", event.target.value)}
                                />
                              </Field>

                              <Field label="Max Open Door Time" htmlFor="device-max-open" delayMs={170}>
                                <Input
                                  id="device-max-open"
                                  inputMode="numeric"
                                  value={onboarding.deviceAssignment.maxOpenDoorTime}
                                  onChange={(event) =>
                                    updateDeviceAssignmentField(
                                      "maxOpenDoorTime",
                                      event.target.value.replace(/[^\d]/g, "")
                                    )
                                  }
                                  placeholder="Optional seconds"
                                />
                              </Field>

                              <Field label="Open Door Time" htmlFor="device-open-door" delayMs={180}>
                                <Input
                                  id="device-open-door"
                                  inputMode="numeric"
                                  value={onboarding.deviceAssignment.openDoorTime}
                                  onChange={(event) =>
                                    updateDeviceAssignmentField(
                                      "openDoorTime",
                                      event.target.value.replace(/[^\d]/g, "")
                                    )
                                  }
                                  placeholder="Optional seconds"
                                />
                              </Field>

                              <div className="md:col-span-2">
                                <MultiSelectChecklist
                                  label="Devices"
                                  options={attendanceDeviceOptions}
                                  selectedIds={onboarding.deviceAssignment.deviceIds}
                                  onToggle={(id, checked) =>
                                    updateDeviceAssignmentField(
                                      "deviceIds",
                                      toggleNumericId(onboarding.deviceAssignment.deviceIds, id, checked)
                                    )
                                  }
                                  emptyText="No attendance devices available."
                                  hint="At least one device is required when device setup is enabled."
                                />
                              </div>

                              <div className="grid gap-3 md:col-span-2 md:grid-cols-2 xl:grid-cols-4">
                                <div className="md:col-span-2 xl:col-span-4">
                                  <p className="text-xs text-muted-foreground">
                                    Choose only the controls needed for this employee: enable validity dates to enforce
                                    an active period, local UI right for device-side controls, close delay for delayed
                                    door closing, sync now to push immediately, and continue on error to keep syncing
                                    other devices if one fails.
                                  </p>
                                </div>
                                {[
                                  {
                                    label: "Validity enabled",
                                    description: "Uses the begin and end dates as the active access window.",
                                    checked: onboarding.deviceAssignment.validEnabled,
                                    field: "validEnabled" as const,
                                  },
                                  {
                                    label: "Local UI right",
                                    description: "Allows device-side actions if the controller supports them.",
                                    checked: onboarding.deviceAssignment.localUiRight,
                                    field: "localUiRight" as const,
                                  },
                                  {
                                    label: "Close delay enabled",
                                    description: "Keeps the door open briefly before the controller closes it.",
                                    checked: onboarding.deviceAssignment.closeDelayEnabled,
                                    field: "closeDelayEnabled" as const,
                                  },
                                  {
                                    label: "Sync now",
                                    description: "Pushes this setup to the selected devices immediately after save.",
                                    checked: onboarding.deviceAssignment.syncNow,
                                    field: "syncNow" as const,
                                  },
                                  {
                                    label: "Continue on error",
                                    description: "Keeps syncing other devices even if one selected device fails.",
                                    checked: onboarding.deviceAssignment.continueOnError,
                                    field: "continueOnError" as const,
                                  },
                                ].map((item) => (
                                  <div
                                    key={item.field}
                                    className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
                                  >
                                    <div className="space-y-1">
                                      <span className="block text-sm font-medium text-foreground">{item.label}</span>
                                      <span className="block text-xs text-muted-foreground">{item.description}</span>
                                    </div>
                                    <Switch
                                      checked={item.checked}
                                      onCheckedChange={(checked) => updateDeviceAssignmentField(item.field, checked)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="contacts" className={getStepTransitionClass("contacts")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Contacts</Label>
                    {contacts.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={openAddContactDialog}>
                        <PlusIcon />
                        Add Contact
                      </Button>
                    ) : null}
                  </div>

                  {contacts.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No contacts added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openAddContactDialog}>
                        <PlusIcon />
                        Add Contact
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {contacts.map((contact, index) => (
                        <div key={`contact-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="grid gap-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">Contact {index + 1}</p>
                                {contact.isPrimary ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                    <BadgeCheckIcon className="size-3.5" />
                                    Primary
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {contact.contactType} ·{" "}
                                {joinPhoneWithCountryCode(
                                  getDialCodeForCountry(contact.countryIso),
                                  contact.phoneNumber
                                ) || "No phone"}
                              </p>
                              {contact.email ? (
                                <p className="text-xs text-muted-foreground">Email: {contact.email}</p>
                              ) : null}
                              {contact.notes ? (
                                <p className="text-xs text-muted-foreground">Notes: {contact.notes}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                onClick={() => openEditContactDialog(index)}
                                aria-label={`Edit contact ${index + 1}`}
                                title="Edit"
                              >
                                <PencilIcon />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => requestDelete("contact", index, `Contact ${index + 1}`)}
                                aria-label={`Delete contact ${index + 1}`}
                                title="Delete"
                              >
                                <Trash2Icon />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="addresses" className={getStepTransitionClass("addresses")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Addresses</Label>
                    {addresses.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={addAddress}>
                        <PlusIcon />
                        Add Address
                      </Button>
                    ) : null}
                  </div>
                  {addresses.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No addresses added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addAddress}>
                        <PlusIcon />
                        Add Address
                      </Button>
                    </div>
                  ) : (
                    addresses.map((address, index) => (
                      <div key={`address-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-medium">Address {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {address.addressType} · {address.city || "No city"} · {address.country || "No country"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {address.addressLine1 || "No address line 1"}
                              {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {address.state || "No state"} {address.postalCode ? `· ${address.postalCode}` : ""}
                            </p>
                            {address.isPrimary ? (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <BadgeCheckIcon className="size-3.5" />
                                Primary address
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openEditAddressDialog(index)}
                              aria-label={`Edit address ${index + 1}`}
                              title="Edit"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => requestDelete("address", index, `Address ${index + 1}`)}
                              aria-label={`Delete address ${index + 1}`}
                              title="Delete"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="relatives" className={getStepTransitionClass("relatives")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Relatives</Label>
                    {relatives.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={addRelative}>
                        <PlusIcon />
                        Add Relative
                      </Button>
                    ) : null}
                  </div>
                  {relatives.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No relatives added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addRelative}>
                        <PlusIcon />
                        Add Relative
                      </Button>
                    </div>
                  ) : (
                    relatives.map((relative, index) => (
                      <div key={`relative-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-medium">Relative {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {relative.fullName || "No name"} · {relative.relationship || "No relationship"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {relative.phone || "No phone"} · {relative.email || "No email"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {relative.address || "No address"} · {relative.occupation || "No occupation"}
                            </p>
                            {relative.isEmergencyContact ? (
                              <p className="text-xs font-medium text-primary">Emergency contact</p>
                            ) : null}
                            {relative.isPrimary ? (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <BadgeCheckIcon className="size-3.5" />
                                Primary relative
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openEditRelativeDialog(index)}
                              aria-label={`Edit relative ${index + 1}`}
                              title="Edit"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => requestDelete("relative", index, `Relative ${index + 1}`)}
                              aria-label={`Delete relative ${index + 1}`}
                              title="Delete"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="identifications" className={getStepTransitionClass("identifications")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Identifications</Label>
                    {identifications.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={addIdentification}>
                        <PlusIcon />
                        Add Identification
                      </Button>
                    ) : null}
                  </div>
                  {identifications.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No identifications added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addIdentification}>
                        <PlusIcon />
                        Add Identification
                      </Button>
                    </div>
                  ) : (
                    identifications.map((idDoc, index) => (
                      <div key={`id-doc-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-medium">Identification {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {idDoc.identificationType} · {idDoc.identificationNumber || "No number"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {idDoc.issuedCountry || "No issued country"}
                              {idDoc.expiryDate ? ` · Expires ${idDoc.expiryDate}` : ""}
                            </p>
                            {idDoc.isPrimary ? (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <BadgeCheckIcon className="size-3.5" />
                                Primary identification
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openEditIdentificationDialog(index)}
                              aria-label={`Edit identification ${index + 1}`}
                              title="Edit"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => requestDelete("identification", index, `Identification ${index + 1}`)}
                              aria-label={`Delete identification ${index + 1}`}
                              title="Delete"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="bankAccounts" className={getStepTransitionClass("bankAccounts")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Bank Accounts</Label>
                    {bankAccounts.length > 0 ? (
                      <Button type="button" size="sm" variant="outline" onClick={addBankAccount}>
                        <PlusIcon />
                        Add Bank Account
                      </Button>
                    ) : null}
                  </div>
                  {bankAccounts.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">No bank accounts added.</p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={addBankAccount}>
                        <PlusIcon />
                        Add Bank Account
                      </Button>
                    </div>
                  ) : (
                    bankAccounts.map((bank, index) => (
                      <div key={`bank-${index}`} className="rounded-md border border-border/80 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid gap-1">
                            <p className="text-sm font-medium">Bank Account {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              {bank.bankName || "No bank"} · {bank.accountName || "No account name"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bank.accountNumber || "No account number"} · {bank.branchName || "No branch"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bank.swiftCode || "No SWIFT"}
                              {bank.mobileMoneyProvider && bank.mobileMoneyProvider !== "none"
                                ? ` · ${bank.mobileMoneyProvider}`
                                : ""}
                            </p>
                            {bank.isPrimary ? (
                              <p className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <BadgeCheckIcon className="size-3.5" />
                                Primary bank account
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openEditBankDialog(index)}
                              aria-label={`Edit bank account ${index + 1}`}
                              title="Edit"
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => requestDelete("bankAccount", index, `Bank Account ${index + 1}`)}
                              aria-label={`Delete bank account ${index + 1}`}
                              title="Delete"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="academic" className={getStepTransitionClass("academic")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Academic Qualifications</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addAcademic}>
                      <PlusIcon /> Add Academic
                    </Button>
                  </div>
                  {academicQualifications.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      No academic qualifications. Add using the button above to include full details from the API
                      payload.
                    </div>
                  ) : (
                    academicQualifications.map((a, index) => (
                      <div key={`acad-${index}`} className="rounded-md border border-border/80 bg-card p-3 text-sm">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium">
                              {a.institutionName || "Institution"} — {a.degreeOrCertificate || "Qualification"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {a.fieldOfStudy} {a.startDate ? `(${a.startDate} - ${a.endDate || "present"})` : ""}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="outline" onClick={() => openEditAcademic(index)}>
                              <PencilIcon />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive"
                              onClick={() => requestDelete("academic", index, `Academic ${index + 1}`)}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="professional" className={getStepTransitionClass("professional")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Professional Qualifications</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addProfessional}>
                      <PlusIcon /> Add Professional
                    </Button>
                  </div>
                  {professionalQualifications.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      No professional qualifications added.
                    </div>
                  ) : (
                    professionalQualifications.map((p, index) => (
                      <div key={`prof-${index}`} className="rounded-md border border-border/80 bg-card p-3 text-sm">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium">{p.programmeName || p.issuingOrganization || "Programme"}</div>
                            <div className="text-xs text-muted-foreground">{p.institutionName}</div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="outline" onClick={() => openEditProfessional(index)}>
                              <PencilIcon />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive"
                              onClick={() => requestDelete("professional", index, `Professional ${index + 1}`)}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="experience" className={getStepTransitionClass("experience")}>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Experience Details</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addExperience}>
                      <PlusIcon /> Add Experience
                    </Button>
                  </div>
                  {experienceDetails.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      No prior experience entries.
                    </div>
                  ) : (
                    experienceDetails.map((e, index) => (
                      <div key={`exp-${index}`} className="rounded-md border border-border/80 bg-card p-3 text-sm">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium">
                              {e.jobTitle || "Role"} @ {e.companyName || "Company"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {e.startDate} {e.currentlyWorking ? "(current)" : ` - ${e.endDate}`}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="outline" onClick={() => openEditExperience(index)}>
                              <PencilIcon />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive"
                              onClick={() => requestDelete("experience", index, `Experience ${index + 1}`)}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </TabsContents>

            <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-border/60 pt-2.5">
              <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={clearForm}>
                Clear
              </Button>
              <div className="flex items-center gap-1.5">
                {previousVisibleStep ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => {
                      setTabDirection("backward")
                      setCurrentStep(previousVisibleStep)
                    }}
                  >
                    <ChevronLeftIcon className="size-3.5" />
                    Previous
                  </Button>
                ) : null}

                {nextVisibleStep ? (
                  <Button
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => {
                      setTabDirection("forward")
                      setCurrentStep(nextVisibleStep)
                    }}
                  >
                    Next
                    <ChevronRightIcon className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => void submitRegistration()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : isInviteMode ? "Save Invite" : "Save Employee"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Tabs>
      </div>

      {createdEmployeeResult?.onboarding_request ? (
        <Card className="mt-4 border-emerald-300/70 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-emerald-800 dark:text-emerald-200">
              Employee created and onboarding started
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pb-6 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Onboarding No
              </p>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {createdEmployeeResult.onboarding_request.onboarding_no ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Status
              </p>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {createdEmployeeResult.onboarding_request.status ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Title
              </p>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {createdEmployeeResult.onboarding_request.title ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Progress
              </p>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {createdEmployeeResult.onboarding_request.progress_percentage ?? "0%"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Are you sure you want to delete ${pendingDelete.label}? This action cannot be undone.`
                : "Are you sure you want to delete this item?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction onClick={confirmDelete} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingAddressIndex === null ? "Add Address" : "Edit Address"}</DialogTitle>
            <DialogDescription>
              {editingAddressIndex === null
                ? "Capture an address and add it to the list."
                : "Update the selected address."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="draft-address-type">Address Type</Label>
              <Select
                value={draftAddress.addressType}
                onValueChange={(value) => updateDraftAddress("addressType", value ?? "home")}
              >
                <SelectTrigger id="draft-address-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-address-country">Country</Label>
              <Input
                id="draft-address-country"
                value={draftAddress.country}
                onChange={(event) => updateDraftAddress("country", event.target.value)}
                placeholder="Country"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-address-city">City</Label>
              <Input
                id="draft-address-city"
                value={draftAddress.city}
                onChange={(event) => updateDraftAddress("city", event.target.value)}
                placeholder="City"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-address-line1">Address Line 1</Label>
              <Input
                id="draft-address-line1"
                value={draftAddress.addressLine1}
                onChange={(event) => updateDraftAddress("addressLine1", event.target.value)}
                placeholder="Street and number"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-address-line2">Address Line 2</Label>
              <Input
                id="draft-address-line2"
                value={draftAddress.addressLine2}
                onChange={(event) => updateDraftAddress("addressLine2", event.target.value)}
                placeholder="Apartment, block, landmark"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-address-state">State</Label>
              <Input
                id="draft-address-state"
                value={draftAddress.state}
                onChange={(event) => updateDraftAddress("state", event.target.value)}
                placeholder="State / Region"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-address-postal">Postal Code</Label>
              <Input
                id="draft-address-postal"
                value={draftAddress.postalCode}
                onChange={(event) => updateDraftAddress("postalCode", event.target.value)}
                placeholder="Postal code"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-2 xl:col-span-3">
              <Checkbox
                checked={draftAddress.isPrimary}
                onCheckedChange={(checked) => updateDraftAddress("isPrimary", Boolean(checked))}
              />
              Primary address
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftAddress}>
              {editingAddressIndex === null ? "Save Address" : "Update Address"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={isRelativeDialogOpen} onOpenChange={setIsRelativeDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingRelativeIndex === null ? "Add Relative" : "Edit Relative"}</DialogTitle>
            <DialogDescription>
              {editingRelativeIndex === null
                ? "Capture a relative and add to the list."
                : "Update the selected relative."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="draft-relative-name">Full Name</Label>
              <Input
                id="draft-relative-name"
                value={draftRelative.fullName}
                onChange={(event) => updateDraftRelative("fullName", event.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-relative-relationship">Relationship</Label>
              <Select
                value={draftRelative.relationship}
                onValueChange={(value) => updateDraftRelative("relationship", value ?? "")}
              >
                <SelectTrigger id="draft-relative-relationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-relative-phone">Phone</Label>
              <div className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
                <Select
                  value={
                    draftRelative.phone.startsWith("+")
                      ? (Object.keys(COUNTRY_DIAL_BY_ISO).find((iso) =>
                          draftRelative.phone.startsWith(COUNTRY_DIAL_BY_ISO[iso as keyof typeof COUNTRY_DIAL_BY_ISO])
                        ) ?? "TZ")
                      : "TZ"
                  }
                  onValueChange={(isoCode) => {
                    const safeIsoCode = isoCode ?? "TZ"
                    const dial = getDialCodeForCountry(safeIsoCode)
                    const stripped = draftRelative.phone.replace(/^\+\d+/, "").replace(/\D/g, "")
                    updateDraftRelative("phone", `${dial}${stripped}`)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Country code" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COUNTRY_DIAL_BY_ISO) as CountryIso[]).map((iso) => (
                      <SelectItem key={iso} value={iso}>
                        {COUNTRY_LABELS[iso].primary} ({COUNTRY_LABELS[iso].secondary})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="draft-relative-phone"
                  value={draftRelative.phone.replace(/^\+\d+/, "")}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "")
                    const iso =
                      (Object.keys(COUNTRY_DIAL_BY_ISO).find((code) =>
                        draftRelative.phone.startsWith(COUNTRY_DIAL_BY_ISO[code as keyof typeof COUNTRY_DIAL_BY_ISO])
                      ) as CountryIso | undefined) ?? "TZ"
                    updateDraftRelative("phone", `${getDialCodeForCountry(iso)}${digits}`)
                  }}
                  placeholder="Phone number"
                />
              </div>
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-relative-email">Email</Label>
              <Input
                id="draft-relative-email"
                type="email"
                value={draftRelative.email}
                onChange={(event) => updateDraftRelative("email", event.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-relative-address">Address</Label>
              <Input
                id="draft-relative-address"
                value={draftRelative.address}
                onChange={(event) => updateDraftRelative("address", event.target.value)}
                placeholder="Address"
              />
            </div>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3">
              <Label htmlFor="draft-relative-occupation">Occupation</Label>
              <Input
                id="draft-relative-occupation"
                value={draftRelative.occupation}
                onChange={(event) => updateDraftRelative("occupation", event.target.value)}
                placeholder="Occupation"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={draftRelative.isEmergencyContact}
                onCheckedChange={(checked) => updateDraftRelative("isEmergencyContact", Boolean(checked))}
              />
              Emergency contact
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={draftRelative.isPrimary}
                onCheckedChange={(checked) => updateDraftRelative("isPrimary", Boolean(checked))}
              />
              Primary relative
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftRelative}>
              {editingRelativeIndex === null ? "Save Relative" : "Update Relative"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={isIdentificationDialogOpen} onOpenChange={setIsIdentificationDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>
              {editingIdentificationIndex === null ? "Add Identification" : "Edit Identification"}
            </DialogTitle>
            <DialogDescription>
              {editingIdentificationIndex === null
                ? "Capture an identification record and add it."
                : "Update the selected identification record."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="draft-identification-type">Identification Type</Label>
              <Select
                value={draftIdentification.identificationType}
                onValueChange={(value) => updateDraftIdentification("identificationType", value ?? "national_id")}
              >
                <SelectTrigger id="draft-identification-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {IDENTIFICATION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-identification-number">Identification Number</Label>
              <Input
                id="draft-identification-number"
                value={draftIdentification.identificationNumber}
                onChange={(event) => updateDraftIdentification("identificationNumber", event.target.value)}
                placeholder="ID number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-identification-country">Issued Country</Label>
              <Input
                id="draft-identification-country"
                value={draftIdentification.issuedCountry}
                onChange={(event) => updateDraftIdentification("issuedCountry", event.target.value)}
                placeholder="Issued country"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-identification-expiry">Expiry Date</Label>
              <DatePickerPresets
                id="draft-identification-expiry"
                value={draftIdentification.expiryDate}
                onChange={(value) => updateDraftIdentification("expiryDate", value)}
                placeholder="Expiry date"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-2">
              <Checkbox
                checked={draftIdentification.isPrimary}
                onCheckedChange={(checked) => updateDraftIdentification("isPrimary", Boolean(checked))}
              />
              Primary identification
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftIdentification}>
              {editingIdentificationIndex === null ? "Save Identification" : "Update Identification"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingBankIndex === null ? "Add Bank Account" : "Edit Bank Account"}</DialogTitle>
            <DialogDescription>
              {editingBankIndex === null
                ? "Capture bank or mobile money account details."
                : "Update the selected bank account details."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="md:col-span-2 xl:col-span-3">
              <Label className="flex items-center gap-x-3 text-sm font-medium">
                <Switch
                  checked={isDraftBankMobileMoney}
                  onCheckedChange={(checked) => setDraftBankMode(Boolean(checked))}
                />
                {isDraftBankMobileMoney ? "Mobile money account" : "Bank account"}
              </Label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-name">{isDraftBankMobileMoney ? "Mobile Money Provider" : "Bank Name"}</Label>
              {isDraftBankMobileMoney ? (
                <Select
                  value={draftBankAccount.mobileMoneyProvider}
                  onValueChange={(value) => {
                    const nextProvider = value && value !== "none" ? value : DEFAULT_MOBILE_MONEY_PROVIDER
                    updateDraftBankAccount("mobileMoneyProvider", nextProvider)
                    updateDraftBankAccount("bankName", nextProvider)
                  }}
                >
                  <SelectTrigger id="draft-bank-name">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOBILE_MONEY_PROVIDER_OPTIONS.filter((option) => option !== "none").map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="draft-bank-name"
                  value={draftBankAccount.bankName}
                  onChange={(event) => updateDraftBankAccount("bankName", event.target.value)}
                  placeholder="Bank name"
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-account-name">Account Name</Label>
              <Input
                id="draft-bank-account-name"
                value={draftBankAccount.accountName}
                onChange={(event) => updateDraftBankAccount("accountName", event.target.value)}
                placeholder="Account name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-account-number">
                {isDraftBankMobileMoney ? "Phone Number" : "Account Number"}
              </Label>
              <Input
                id="draft-bank-account-number"
                value={draftBankAccount.accountNumber}
                onChange={(event) => updateDraftBankAccount("accountNumber", event.target.value)}
                placeholder={isDraftBankMobileMoney ? "Phone number" : "Account number"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-branch">Branch Name{isDraftBankMobileMoney ? " (optional)" : ""}</Label>
              <Input
                id="draft-bank-branch"
                value={draftBankAccount.branchName}
                onChange={(event) => updateDraftBankAccount("branchName", event.target.value)}
                placeholder="Branch name"
                disabled={isDraftBankMobileMoney}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-bank-swift">SWIFT Code (optional)</Label>
              <Input
                id="draft-bank-swift"
                value={draftBankAccount.swiftCode}
                onChange={(event) => updateDraftBankAccount("swiftCode", event.target.value)}
                placeholder="SWIFT code"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium md:col-span-2 xl:col-span-3">
              <Checkbox
                checked={draftBankAccount.isPrimary}
                onCheckedChange={(checked) => updateDraftBankAccount("isPrimary", Boolean(checked))}
              />
              Primary bank account
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftBankAccount}>
              {editingBankIndex === null ? "Save Bank Account" : "Update Bank Account"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Academic dialog */}
      <Dialog open={isAcademicDialogOpen} onOpenChange={setIsAcademicDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>
              {editingAcademicIndex === null ? "Add Academic Qualification" : "Edit Academic Qualification"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Country</Label>
              <Input
                value={draftAcademic.countryOfResidence}
                onChange={(e) => updateDraftAcademic("countryOfResidence", e.target.value)}
              />
            </div>
            <div>
              <Label>Education Level</Label>
              <Input
                value={draftAcademic.educationLevel}
                onChange={(e) => updateDraftAcademic("educationLevel", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Institution</Label>
              <Input
                value={draftAcademic.institutionName}
                onChange={(e) => updateDraftAcademic("institutionName", e.target.value)}
              />
            </div>
            <div>
              <Label>Degree / Certificate</Label>
              <Input
                value={draftAcademic.degreeOrCertificate}
                onChange={(e) => updateDraftAcademic("degreeOrCertificate", e.target.value)}
              />
            </div>
            <div>
              <Label>Field of Study</Label>
              <Input
                value={draftAcademic.fieldOfStudy}
                onChange={(e) => updateDraftAcademic("fieldOfStudy", e.target.value)}
              />
            </div>
            <div>
              <Label>Start Date</Label>
              <DateInput
                className="max-w-none"
                value={draftAcademic.startDate}
                onChange={(e) => updateDraftAcademic("startDate", e.target.value)}
                placeholder="Select start date"
              />
            </div>
            <div>
              <Label>End Date</Label>
              <DateInput
                className="max-w-none"
                value={draftAcademic.endDate}
                onChange={(e) => updateDraftAcademic("endDate", e.target.value)}
                placeholder="Select end date"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Certificate Document URL</Label>
              <Input
                value={draftAcademic.certificateUrl}
                onChange={(e) => updateDraftAcademic("certificateUrl", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftAcademic}>
              {editingAcademicIndex === null ? "Save" : "Update"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Professional dialog */}
      <Dialog open={isProfessionalDialogOpen} onOpenChange={setIsProfessionalDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{editingProfessionalIndex === null ? "Add Professional Qualification" : "Edit"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Country</Label>
              <Input
                value={draftProfessional.countryOfResidence}
                onChange={(e) => updateDraftProfessional("countryOfResidence", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Institution</Label>
              <Input
                value={draftProfessional.institutionName}
                onChange={(e) => updateDraftProfessional("institutionName", e.target.value)}
              />
            </div>
            <div>
              <Label>Programme</Label>
              <Input
                value={draftProfessional.programmeName}
                onChange={(e) => updateDraftProfessional("programmeName", e.target.value)}
              />
            </div>
            <div>
              <Label>Issuing Organization</Label>
              <Input
                value={draftProfessional.issuingOrganization}
                onChange={(e) => updateDraftProfessional("issuingOrganization", e.target.value)}
              />
            </div>
            <div>
              <Label>Issue Date</Label>
              <DateInput
                className="max-w-none"
                value={draftProfessional.issueDate}
                onChange={(e) => updateDraftProfessional("issueDate", e.target.value)}
                placeholder="Select issue date"
              />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <DateInput
                className="max-w-none"
                value={draftProfessional.expiryDate}
                onChange={(e) => updateDraftProfessional("expiryDate", e.target.value)}
                placeholder="Select expiry date"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Certificate URL</Label>
              <Input
                value={draftProfessional.certificateUrl}
                onChange={(e) => updateDraftProfessional("certificateUrl", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftProfessional}>
              {editingProfessionalIndex === null ? "Save" : "Update"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Experience dialog */}
      <Dialog open={isExperienceDialogOpen} onOpenChange={setIsExperienceDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{editingExperienceIndex === null ? "Add Experience" : "Edit Experience"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Company</Label>
              <Input
                value={draftExperience.companyName}
                onChange={(e) => updateDraftExperience("companyName", e.target.value)}
              />
            </div>
            <div>
              <Label>Job Title</Label>
              <Input
                value={draftExperience.jobTitle}
                onChange={(e) => updateDraftExperience("jobTitle", e.target.value)}
              />
            </div>
            <div>
              <Label>Responsibilities</Label>
              <Textarea
                value={draftExperience.responsibilities}
                onChange={(e) => updateDraftExperience("responsibilities", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <DateInput
                  className="max-w-none"
                  value={draftExperience.startDate}
                  onChange={(e) => updateDraftExperience("startDate", e.target.value)}
                  placeholder="Select start date"
                />
              </div>
              <div>
                <Label>End</Label>
                <DateInput
                  className="max-w-none"
                  value={draftExperience.endDate}
                  onChange={(e) => updateDraftExperience("endDate", e.target.value)}
                  disabled={draftExperience.currentlyWorking}
                  placeholder="Select end date"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draftExperience.currentlyWorking}
                onCheckedChange={(v) => updateDraftExperience("currentlyWorking", Boolean(v))}
              />{" "}
              Currently working here
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftExperience}>
              {editingExperienceIndex === null ? "Save" : "Update"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogPopup from="right" className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingContactIndex === null ? "Add Contact" : "Edit Contact"}</DialogTitle>
            <DialogDescription>
              {editingContactIndex === null
                ? "Capture a contact and save it to the contacts list."
                : "Update the selected contact."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="draft-contact-type">Contact Type</Label>
              <Select
                value={draftContact.contactType}
                onValueChange={(value) => updateDraftContact("contactType", value ?? "personal")}
              >
                <SelectTrigger id="draft-contact-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-contact-phone">Phone Number</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)]">
                <ReactFlagsSelect
                  id="draft-contact-country"
                  rfsKey="draft-contact-country"
                  selected={draftContact.countryIso}
                  onSelect={(value) => updateDraftContact("countryIso", value)}
                  customLabels={COUNTRY_LABELS}
                  searchable
                  searchPlaceholder="Search country"
                  fullWidth
                  showSelectedLabel={false}
                  showOptionLabel
                  showSecondarySelectedLabel
                  showSecondaryOptionLabel
                  selectButtonClassName={cn(
                    "!h-9 !w-full !min-w-0 !rounded-md !border !px-2.5 !py-1.5 !text-sm !shadow-none",
                    draftContactPhoneError ? "!border-destructive" : "!border-input"
                  )}
                  className="w-full min-w-0"
                />
                <Input
                  id="draft-contact-phone"
                  value={draftContact.phoneNumber}
                  className={cn(
                    draftContactPhoneError
                      ? "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
                      : undefined
                  )}
                  onChange={(event) => {
                    updateDraftContactPhone(event.target.value)
                    if (draftContactEmailError) {
                      setDraftContactEmailError("")
                    }
                  }}
                  placeholder="712345678"
                />
              </div>
              {draftContactPhoneError ? <p className="text-xs text-destructive">{draftContactPhoneError}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-contact-email">Email</Label>
              <Input
                id="draft-contact-email"
                type="email"
                value={draftContact.email}
                className={cn(
                  draftContactEmailError
                    ? "border-destructive text-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
                    : undefined
                )}
                onChange={(event) => {
                  updateDraftContact("email", event.target.value)
                  if (draftContactEmailError) {
                    setDraftContactEmailError("")
                  }
                  if (draftContactPhoneError) {
                    setDraftContactPhoneError("")
                  }
                }}
                placeholder="user@example.com"
              />
              {draftContactEmailError ? <p className="text-xs text-destructive">{draftContactEmailError}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-contact-notes">Notes (optional)</Label>
              <Input
                id="draft-contact-notes"
                value={draftContact.notes}
                onChange={(event) => updateDraftContact("notes", event.target.value)}
                placeholder="Additional notes"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={draftContact.isPrimary}
                onCheckedChange={(checked) => updateDraftContact("isPrimary", Boolean(checked))}
              />
              Primary contact
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="button" onClick={saveDraftContact}>
              {editingContactIndex === null ? "Save Contact" : "Update Contact"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
