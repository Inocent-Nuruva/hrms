"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { getCountryCallingCode } from "libphonenumber-js"
import { countries as countryCodes } from "country-flag-icons"
import * as FlagIcons from "country-flag-icons/react/3x2"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Textarea } from "@/components/ui/textarea"
import {
  createEmployeeDocument,
  createEmployeeSectionItem,
  deleteEmployeeDocument,
  deleteEmployeeSectionItem,
  EMPLOYEE_STATUS_VALUES,
  getEmployeeById,
  isEmployeeStatusValue,
  listEmployees,
  patchEmployeeStatus,
  patchEmployeeSectionItem,
  updateUserById,
  type AdminRecord,
  type EmployeeStatusPayload,
  type EmployeeProfileSection,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const EMPLOYEE_STATUS_REFRESH_KEY = "hrms.employees.status.updatedAt"
const EMPLOYEE_STATUS_REFRESH_EVENT = "hrms:employee-status-updated"

type EmployeeStatusFormState = {
  employment_status: EmployeeStatusPayload["employment_status"]
  exit_date: string
  exit_reason: string
  notes: string
}

function normalizeEmployeeStatus(value: unknown): EmployeeStatusPayload["employment_status"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return isEmployeeStatusValue(normalized) ? normalized : "active"
}

function readEmployeeStatusForm(employee: AdminRecord): EmployeeStatusFormState {
  const status = normalizeEmployeeStatus(employee.employment_status ?? employee.status)
  const exitDate = readString(employee, ["exit_date"]) === "-" ? "" : readString(employee, ["exit_date"])
  const exitReason = readString(employee, ["exit_reason"]) === "-" ? "" : readString(employee, ["exit_reason"])
  const notes = readString(employee, ["notes"]) === "-" ? "" : readString(employee, ["notes"])

  return {
    employment_status: status,
    exit_date: status === "exited" ? exitDate : "",
    exit_reason: status === "exited" ? exitReason : "",
    notes,
  }
}

function validateStatusForm(form: EmployeeStatusFormState) {
  if (!isEmployeeStatusValue(form.employment_status)) {
    return "Please select a valid employment status."
  }

  const notes = form.notes.trim()
  if ((form.employment_status === "suspended" || form.employment_status === "terminated") && notes.length < 3) {
    return "Please provide at least 3 characters of notes for suspended or terminated status."
  }

  if (form.employment_status === "exited") {
    const exitReason = form.exit_reason.trim()
    if (exitReason.length < 3) {
      return "Exit reason must be at least 3 characters."
    }

    const exitDate = form.exit_date.trim()
    if (!exitDate) {
      return "Exit date is required for exited status."
    }

    const parsed = new Date(exitDate)
    if (Number.isNaN(parsed.getTime())) {
      return "Exit date is invalid."
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    parsed.setHours(0, 0, 0, 0)
    if (parsed.getTime() > today.getTime()) {
      return "Exit date cannot be in the future."
    }
  }

  return null
}

function readStoredToken() {
  if (typeof window === "undefined") {
    return ""
  }

  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) {
    return direct
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) {
    return ""
  }

  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return "-"
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry) => typeof entry === "object" && entry !== null) as AdminRecord[]
}

function firstRecordArray(...values: unknown[]) {
  for (const value of values) {
    const list = asRecordArray(value)
    if (list.length > 0) {
      return list
    }
  }
  return [] as AdminRecord[]
}

function readNestedString(value: unknown, keys: string[]) {
  const record = asRecord(value)
  if (!record) {
    return "-"
  }
  return readString(record, keys)
}

function mergeEmployeeProfileRecord(record: AdminRecord | null) {
  if (!record) {
    return null
  }

  const nestedEmployee =
    asRecord(record.employee) ??
    asRecord(record.employee_profile) ??
    asRecord(record.profile) ??
    null

  const merged: AdminRecord = {
    ...record,
    ...(nestedEmployee ?? {}),
  }

  if (!merged.company_user && record.companyUser) {
    merged.company_user = record.companyUser
  }
  if (!merged.primary_branch && record.primaryBranch) {
    merged.primary_branch = record.primaryBranch
  }
  if (!merged.primary_department && record.primaryDepartment) {
    merged.primary_department = record.primaryDepartment
  }
  if (!merged.primary_position && record.primaryPosition) {
    merged.primary_position = record.primaryPosition
  }
  if (!merged.position && record.positionDetail) {
    merged.position = record.positionDetail
  }
  if (!merged.manager && record.managerDetail) {
    merged.manager = record.managerDetail
  }

  if (!merged.contacts && record.contact_details) {
    merged.contacts = record.contact_details
  }
  if (!merged.addresses && record.addressDetails) {
    merged.addresses = record.addressDetails
  }
  if (!merged.relatives && record.nextOfKin) {
    merged.relatives = record.nextOfKin
  }
  if (!merged.identifications && record.identificationDocuments) {
    merged.identifications = record.identificationDocuments
  }
  if (!merged.bank_accounts && record.bankAccounts) {
    merged.bank_accounts = record.bankAccounts
  }
  if (!merged.academic_qualifications && record.academicQualifications) {
    merged.academic_qualifications = record.academicQualifications
  }
  if (!merged.professional_qualifications && record.professionalQualifications) {
    merged.professional_qualifications = record.professionalQualifications
  }
  if (!merged.experience_details && record.experienceDetails) {
    merged.experience_details = record.experienceDetails
  }

  return merged
}

function formatProfileDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
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

function getProfileSectionItems(employee: AdminRecord, keys: string[]) {
  const values = keys.map((key) => employee[key])
  return firstRecordArray(...values)
}

function employeeDisplayName(row: AdminRecord) {
  const named = readString(row, ["full_name", "fullName", "employee_name", "employeeName", "name"])
  if (named !== "-") {
    return named
  }
  const first = readString(row, ["first_name", "firstName"])
  const middle = readString(row, ["middle_name", "middleName"])
  const last = readString(row, ["last_name", "lastName"])
  return [first, middle, last].filter((part) => part !== "-").join(" ").trim() || "-"
}

function employeeDisplayNameFromLinkedUser(row: AdminRecord) {
  const companyUser = resolveCompanyUserRecord(row)
  if (companyUser) {
    const userNamed = readString(companyUser, ["full_name", "fullName", "employee_name", "employeeName", "name"])
    if (userNamed !== "-") {
      return userNamed
    }
    const userFirst = readString(companyUser, ["first_name", "firstName"])
    const userLast = readString(companyUser, ["last_name", "lastName"])
    const userName = [userFirst, userLast].filter((part) => part !== "-").join(" ").trim()
    if (userName) {
      return userName
    }
  }
  return employeeDisplayName(row)
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
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
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function formatLabelValue(value: string) {
  if (!value || value === "-") return "-"
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function statusTone(status: string) {
  const normalized = status.trim().toLowerCase()
  if (["active", "confirmed", "employed", "onboarding"].includes(normalized)) {
    return "text-emerald-600 dark:text-emerald-400"
  }
  if (["pending", "probation", "suspended"].includes(normalized)) {
    return "text-amber-600 dark:text-amber-400"
  }
  if (["terminated", "exited", "inactive"].includes(normalized)) {
    return "text-rose-600 dark:text-rose-400"
  }
  return "text-foreground"
}

function SummaryField({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 py-1">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-sm font-medium text-foreground">
        {children ?? value ?? "-"}
      </dd>
    </div>
  )
}

function recordPreview(record: AdminRecord) {
  return [
    readString(record, ["name", "type", "contact_type", "bank_name", "institution", "employee_no", "code"]),
    readString(record, ["email", "phone_number", "phone", "account_number", "id_number"]),
  ]
    .filter((entry) => entry !== "-")
    .join(" • ") || "Record"
}

function renderRecordFields(record: AdminRecord, sectionTitle: string) {
  const fields: Array<{ label: string; value: string }> = []

  const normalizeLabel = (key: string) => {
    if (key === "is_primary") {
      if (sectionTitle.toLowerCase() === "departments") {
        return "Primary Department"
      }
      return "Primary Contact"
    }
    if (key === "is_verified") {
      return "Verified"
    }
    return key.replace(/_/g, " ")
  }

  const normalizeValue = (key: string, value: unknown) => {
    if (typeof value === "boolean") {
      if (key === "is_primary" || key === "is_verified") {
        return value ? "Yes" : "No"
      }
      return value ? "Yes" : "No"
    }
    return String(value)
  }

  for (const [key, rawValue] of Object.entries(record)) {
    if (key === "id" || key.endsWith("_id")) {
      continue
    }
    if (rawValue === null || rawValue === undefined) {
      continue
    }
    if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      fields.push({ label: normalizeLabel(key), value: normalizeValue(key, rawValue) })
      continue
    }
    if (Array.isArray(rawValue)) {
      fields.push({ label: normalizeLabel(key), value: `${rawValue.length} item(s)` })
      continue
    }
    const nested = asRecord(rawValue)
    if (nested) {
      const nestedSummary = [readString(nested, ["name"]), readString(nested, ["code"]), readString(nested, ["email"])]
        .filter((entry) => entry !== "-")
        .join(" • ")
      fields.push({ label: normalizeLabel(key), value: nestedSummary || "Available" })
    }
  }
  return fields
}

function readNumber(value: unknown): number | null {
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

function resolveCompanyUserId(employee: AdminRecord): number | null {
  const companyUser = asRecord(employee.company_user)
  if (!companyUser) {
    return null
  }

  const directUserId = readNumber(companyUser.user_id)
  if (directUserId !== null) {
    return directUserId
  }

  const nestedUser = asRecord(companyUser.user)
  if (!nestedUser) {
    return null
  }

  return readNumber(nestedUser.id)
}

function resolveCompanyUserRecord(employee: AdminRecord): AdminRecord | null {
  const companyUser = asRecord(employee.company_user)
  if (!companyUser) {
    return null
  }

  const nestedUser = asRecord(companyUser.user)
  if (nestedUser) {
    return nestedUser
  }

  return companyUser
}

function sectionTitleToApiSection(title: string): EmployeeProfileSection | null {
  const normalized = title.toLowerCase()
  if (normalized === "contacts") return "contacts"
  if (normalized === "addresses") return "addresses"
  if (normalized === "relatives") return "relatives"
  if (normalized === "identifications") return "identifications"
  if (normalized === "bank accounts") return "bank-accounts"
  if (normalized === "academic qualifications") return "academic-qualifications"
  if (normalized === "professional qualifications") return "professional-qualifications"
  if (normalized === "experience details") return "experience-details"
  return null
}

function sectionTitleToRouteKey(title: string) {
  return title.toLowerCase().replaceAll(" ", "_")
}

function routeKeyToSectionTitle(routeKey: string | null | undefined) {
  if (!routeKey) {
    return null
  }

  const normalized = routeKey.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return (
    {
      contacts: "Contacts",
      documents: "Documents",
      addresses: "Addresses",
      relatives: "Relatives",
      identifications: "Identifications",
      bank_accounts: "Bank Accounts",
      departments: "Departments",
      academic_qualifications: "Academic Qualifications",
      professional_qualifications: "Professional Qualifications",
      experience_details: "Experience Details",
      company_user: "Company User",
    }[normalized] ?? null
  )
}

type SectionEntry = { key: string; label: string; value: string; kind: "text" | "boolean" }

const EDUCATION_LEVEL_OPTIONS = [
  "Primary",
  "Lower Secondary",
  "Upper Secondary",
  "Certificate",
  "Diploma",
  "Advanced Diploma",
  "Bachelor's Degree",
  "Postgraduate Diploma",
  "Master's Degree",
  "Doctorate (PhD)",
  "Professional Qualification",
  "Vocational Training",
  "Other",
]

const DOCUMENT_TYPE_OPTIONS = [
  "certificate",
  "cv",
  "offer_letter",
  "contract",
  "other",
]

const RELATIONSHIP_OPTIONS = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Guardian",
  "Grandparent",
  "Grandchild",
  "Uncle/Aunt",
  "Cousin",
  "Friend",
  "Other",
]

type CountryOption = { code: string; name: string }
type CountryDialOption = { iso: string; code: string; name: string }

const regionDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

function safeCountryName(code: string) {
  try {
    return regionDisplayNames?.of(code) ?? code
  } catch {
    return code
  }
}

const COUNTRY_OPTIONS: CountryOption[] = (countryCodes as string[])
  .map((code) => ({
    code,
    name: safeCountryName(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = (countryCodes as string[])
  .map((iso) => {
    try {
      const callingCode = getCountryCallingCode(iso as Parameters<typeof getCountryCallingCode>[0])
      return { iso, code: `+${callingCode}`, name: safeCountryName(iso) }
    } catch {
      return null
    }
  })
  .filter((entry): entry is CountryDialOption => entry !== null)
  .sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code, undefined, { numeric: true })
    if (codeCompare !== 0) {
      return codeCompare
    }
    return a.name.localeCompare(b.name)
  })

function findCountryOption(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  return (
    COUNTRY_OPTIONS.find(
      (option) => option.name.toLowerCase() === normalized || option.code.toLowerCase() === normalized
    ) ?? null
  )
}

function CountrySelectInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const normalizedValue = value.trim().toLowerCase()
  const selected = COUNTRY_OPTIONS.find(
    (option) => option.name.toLowerCase() === normalizedValue || option.code.toLowerCase() === normalizedValue
  ) ?? null

  const filtered = COUNTRY_OPTIONS.filter((option) => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return true
    }
    return option.name.toLowerCase().includes(term) || option.code.toLowerCase().includes(term)
  })

  const SelectedFlag = selected
    ? (FlagIcons as Record<string, React.ComponentType<{ title?: string; className?: string }>>)[selected.code]
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        }
      >
        <span className="flex items-center gap-2 truncate">
          {SelectedFlag ? <SelectedFlag className="h-4 w-6 rounded-sm border border-slate-200" /> : null}
          <span className="truncate text-slate-900">{selected?.name ?? "Select country"}</span>
        </span>
        <span className="text-slate-400">▼</span>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search country..."
          className="mb-2 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
        />
        <div className="max-h-56 overflow-auto">
          {filtered.map((option) => {
            const Flag = (FlagIcons as Record<string, React.ComponentType<{ title?: string; className?: string }>>)[option.code]
            return (
              <button
                key={option.code}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onChange(option.name)
                  setOpen(false)
                  setSearch("")
                }}
              >
                {Flag ? <Flag className="h-4 w-6 rounded-sm border border-slate-200" /> : null}
                <span className="flex-1 truncate">{option.name}</span>
                <span className="text-xs text-slate-500">{option.code}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "-"
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`
  }
  const mb = kb / 1024
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`
  }
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

function DocumentFileInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const fileMeta = React.useMemo(() => {
    if (!value.trim()) {
      return null
    }
    try {
      const parsed = JSON.parse(value) as {
        file_name?: string
        file_extension?: string
        mime_type?: string
        file_size?: number
      }
      if (parsed && (parsed.file_name || parsed.mime_type || typeof parsed.file_size === "number")) {
        return parsed
      }
    } catch {
      return null
    }
    return null
  }, [value])

  const applyFile = (file: File) => {
    const ext = file.name.includes(".") ? file.name.split(".").pop() ?? "" : ""
    const payload = {
      file_name: file.name,
      file_extension: ext,
      mime_type: file.type || "application/octet-stream",
      file_size: file.size,
    }
    onChange(JSON.stringify(payload))
  }

  return (
    <div className="grid gap-2">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            applyFile(file)
          }
          event.currentTarget.value = ""
        }}
      />
      <button
        type="button"
        className={`min-h-24 rounded-md border border-dashed px-3 py-3 text-left text-sm ${
          isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"
        }`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          const file = event.dataTransfer.files?.[0]
          if (file) {
            applyFile(file)
          }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="mb-1 inline-flex items-center gap-2 font-medium text-slate-700">
          <UploadIcon className="size-4" />
          Drop file here or click to choose
        </span>
      </button>
      {fileMeta ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
          <p><span className="font-semibold">File:</span> {fileMeta.file_name ?? "-"}</p>
          <p><span className="font-semibold">Extension:</span> {fileMeta.file_extension ?? "-"}</p>
          <p><span className="font-semibold">MIME:</span> {fileMeta.mime_type ?? "-"}</p>
          <p><span className="font-semibold">Size:</span> {typeof fileMeta.file_size === "number" ? formatFileSize(fileMeta.file_size) : "-"}</p>
        </div>
      ) : value.trim() ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="JSON metadata"
        />
      ) : null}
    </div>
  )
}

function splitPhoneValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return { dialCode: "+255", number: "" }
  }

  const matched = COUNTRY_DIAL_OPTIONS
    .slice()
    .sort((first, second) => second.code.length - first.code.length)
    .find((option) => trimmed.startsWith(option.code))

  if (!matched) {
    return { dialCode: "+255", number: trimmed }
  }

  return {
    dialCode: matched.code,
    number: trimmed.slice(matched.code.length).trim(),
  }
}

function PhoneWithCountryCodeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const parsed = splitPhoneValue(value)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selected = COUNTRY_DIAL_OPTIONS.find((option) => option.code === parsed.dialCode) ?? null

  const filtered = COUNTRY_DIAL_OPTIONS.filter((option) => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return true
    }
    return (
      option.code.toLowerCase().includes(term) ||
      option.name.toLowerCase().includes(term) ||
      option.iso.toLowerCase().includes(term)
    )
  })

  const SelectedFlag = selected
    ? (FlagIcons as Record<string, React.ComponentType<{ title?: string; className?: string }>>)[selected.iso]
    : null

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex h-10 w-36 items-center justify-between rounded-md border border-slate-300 bg-white px-2 text-sm"
            />
          }
        >
          <span className="flex items-center gap-2 truncate">
            {SelectedFlag ? <SelectedFlag className="h-4 w-6 rounded-sm border border-slate-200" /> : null}
            <span className="truncate text-slate-900">{selected?.code ?? parsed.dialCode}</span>
          </span>
          <span className="text-slate-400">▼</span>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code or country..."
            className="mb-2 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
          />
          <div className="max-h-56 overflow-auto">
            {filtered.map((option) => {
              const Flag = (FlagIcons as Record<string, React.ComponentType<{ title?: string; className?: string }>>)[option.iso]
              return (
                <button
                  key={`${option.iso}-${option.code}`}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    onChange(`${option.code}${parsed.number}`)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  {Flag ? <Flag className="h-4 w-6 rounded-sm border border-slate-200" /> : null}
                  <span className="font-medium text-slate-900">{option.code}</span>
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
      <input
        value={parsed.number}
        onChange={(event) => {
          const digits = event.target.value
          onChange(`${parsed.dialCode}${digits}`)
        }}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        placeholder="Phone number"
      />
    </div>
  )
}

function renderEntryInput({
  entry,
  value,
  onChange,
}: {
  entry: SectionEntry
  value: string
  onChange: (value: string) => void
}) {
  if (entry.kind === "boolean") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  if (entry.key === "education_level") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
      >
        <option value="">Select education level</option>
        {EDUCATION_LEVEL_OPTIONS.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    )
  }

  if (entry.key === "type") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
      >
        <option value="">Select document type</option>
        {DOCUMENT_TYPE_OPTIONS.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    )
  }

  if (entry.key === "relationship") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
      >
        <option value="">Select relationship</option>
        {RELATIONSHIP_OPTIONS.map((relationship) => (
          <option key={relationship} value={relationship}>
            {relationship}
          </option>
        ))}
      </select>
    )
  }

  if (entry.key === "phone" || entry.key === "phone_number") {
    return <PhoneWithCountryCodeInput value={value} onChange={onChange} />
  }

  if (
    entry.key === "file_url" ||
    entry.key === "academic_certificate_document_url" ||
    entry.key === "professional_certificate_document_url"
  ) {
    return <DocumentFileInput value={value} onChange={onChange} />
  }

  if (entry.key.includes("country")) {
    return <CountrySelectInput value={value} onChange={onChange} />
  }

  if (entry.key === "responsibilities_description" || entry.key === "notes") {
    return (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    )
  }

  if (entry.key.endsWith("_date")) {
    return (
      <DatePickerPresets value={value} onChange={onChange} />
    )
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
    />
  )
}

function sectionSchema(sectionTitle: string): SectionEntry[] {
  const name = sectionTitle.toLowerCase()
  if (name === "contacts") {
    return [
      { key: "contact_type", label: "Contact Type", value: "personal", kind: "text" },
      { key: "is_primary", label: "Primary Contact", value: "false", kind: "boolean" },
      { key: "is_verified", label: "Verified", value: "false", kind: "boolean" },
      { key: "phone_number", label: "Phone Number", value: "", kind: "text" },
      { key: "email", label: "Email", value: "", kind: "text" },
      { key: "notes", label: "Notes", value: "", kind: "text" },
    ]
  }
  if (name === "addresses") {
    return [
      { key: "address_type", label: "Address Type", value: "home", kind: "text" },
      { key: "is_primary", label: "Primary Address", value: "false", kind: "boolean" },
      { key: "address_line_1", label: "Address Line 1", value: "", kind: "text" },
      { key: "address_line_2", label: "Address Line 2", value: "", kind: "text" },
      { key: "city", label: "City", value: "", kind: "text" },
      { key: "state", label: "State", value: "", kind: "text" },
      { key: "country", label: "Country", value: "", kind: "text" },
      { key: "postal_code", label: "Postal Code", value: "", kind: "text" },
    ]
  }
  if (name === "relatives") {
    return [
      { key: "is_emergency_contact", label: "Emergency Contact", value: "false", kind: "boolean" },
      { key: "is_primary", label: "Primary Relative", value: "false", kind: "boolean" },
      { key: "full_name", label: "Full Name", value: "", kind: "text" },
      { key: "relationship", label: "Relationship", value: "", kind: "text" },
      { key: "phone", label: "Phone", value: "", kind: "text" },
      { key: "email", label: "Email", value: "", kind: "text" },
      { key: "address", label: "Address", value: "", kind: "text" },
      { key: "occupation", label: "Occupation", value: "", kind: "text" },
    ]
  }
  if (name === "identifications") {
    return [
      { key: "identification_type", label: "Identification Type", value: "national_id", kind: "text" },
      { key: "is_primary", label: "Primary Identification", value: "false", kind: "boolean" },
      { key: "identification_number", label: "Identification Number", value: "", kind: "text" },
      { key: "issued_country", label: "Issued Country", value: "", kind: "text" },
      { key: "expiry_date", label: "Expiry Date", value: "", kind: "text" },
    ]
  }
  if (name === "bank accounts") {
    return [
      { key: "is_primary", label: "Primary Account", value: "false", kind: "boolean" },
      { key: "bank_name", label: "Bank Name", value: "", kind: "text" },
      { key: "account_name", label: "Account Name", value: "", kind: "text" },
      { key: "account_number", label: "Account Number", value: "", kind: "text" },
      { key: "branch_name", label: "Branch Name", value: "", kind: "text" },
      { key: "swift_code", label: "Swift Code", value: "", kind: "text" },
      { key: "mobile_money_provider", label: "Mobile Money Provider", value: "", kind: "text" },
    ]
  }
  if (name === "academic qualifications") {
    return [
      { key: "country_of_residence", label: "Country of Residence", value: "", kind: "text" },
      { key: "education_level", label: "Education Level", value: "", kind: "text" },
      { key: "institution_name", label: "Institution Name", value: "", kind: "text" },
      { key: "degree_or_certificate", label: "Degree or Certificate", value: "", kind: "text" },
      { key: "field_of_study", label: "Field of Study", value: "", kind: "text" },
      { key: "start_date", label: "Start Date", value: "", kind: "text" },
      { key: "end_date", label: "End Date", value: "", kind: "text" },
      { key: "academic_certificate_document_url", label: "Academic Certificate URL", value: "", kind: "text" },
    ]
  }
  if (name === "professional qualifications") {
    return [
      { key: "country_of_residence", label: "Country of Residence", value: "", kind: "text" },
      { key: "institution_name", label: "Institution Name", value: "", kind: "text" },
      { key: "programme_name", label: "Programme Name", value: "", kind: "text" },
      { key: "issuing_organization", label: "Issuing Organization", value: "", kind: "text" },
      { key: "issue_date", label: "Issue Date", value: "", kind: "text" },
      { key: "expiry_date", label: "Expiry Date", value: "", kind: "text" },
      { key: "professional_certificate_document_url", label: "Professional Certificate Attachment", value: "", kind: "text" },
    ]
  }
  if (name === "experience details") {
    return [
      { key: "company_name", label: "Company Name", value: "", kind: "text" },
      { key: "job_title", label: "Job Title", value: "", kind: "text" },
      { key: "responsibilities_description", label: "Responsibilities Description", value: "", kind: "text" },
      { key: "start_date", label: "Start Date", value: "", kind: "text" },
      { key: "end_date", label: "End Date", value: "", kind: "text" },
      { key: "currently_working", label: "Currently Working", value: "false", kind: "boolean" },
    ]
  }
  if (name === "documents") {
    return [
      { key: "type", label: "Type", value: "other", kind: "text" },
      { key: "title", label: "Title", value: "", kind: "text" },
      { key: "file_url", label: "Attachment", value: "", kind: "text" },
      { key: "notes", label: "Notes", value: "", kind: "text" },
    ]
  }
  return []
}

function editableEntries(record: AdminRecord, sectionTitle: string) {
  const schema = sectionSchema(sectionTitle)
  if (schema.length > 0) {
    return schema.map((entry) => {
      const raw = record[entry.key]
      if (entry.kind === "boolean") {
        return { ...entry, value: raw === true ? "true" : "false" }
      }
      if (raw === null || raw === undefined) {
        return { ...entry, value: "" }
      }
      return { ...entry, value: String(raw) }
    })
  }

  const hiddenKeys = new Set(["id", "employee_id", "company_user_id", "company_id", "user_id", "created_at", "updated_at"])
  const entries: Array<{ key: string; label: string; value: string; kind: "text" | "boolean" }> = []

  for (const [key, rawValue] of Object.entries(record)) {
    if (hiddenKeys.has(key) || key.endsWith("_id")) {
      continue
    }
    if (rawValue === null || rawValue === undefined) {
      continue
    }
    if (Array.isArray(rawValue) || typeof rawValue === "object") {
      continue
    }

    let label = key.replace(/_/g, " ")
    if (key === "is_primary") {
      label = sectionTitle.toLowerCase() === "departments" ? "Primary Department" : "Primary Contact"
    }
    if (key === "is_verified") {
      label = "Verified"
    }

    if (typeof rawValue === "boolean") {
      entries.push({ key, label, value: rawValue ? "true" : "false", kind: "boolean" })
      continue
    }

    entries.push({ key, label, value: String(rawValue), kind: "text" })
  }

  return entries
}

const PROFILE_SECTION_DEFS: Array<{
  title: string
  /** Compact tab label (matches Employees top-tab density). Full title used in content. */
  tabLabel: string
  keys: string[]
  special?: "company_user"
}> = [
  { title: "Contacts", tabLabel: "Contacts", keys: ["contacts", "contact_details", "contactDetails"] },
  { title: "Documents", tabLabel: "Documents", keys: ["documents", "employee_documents", "employeeDocuments"] },
  { title: "Addresses", tabLabel: "Addresses", keys: ["addresses", "address_details", "addressDetails"] },
  { title: "Relatives", tabLabel: "Relatives", keys: ["relatives", "next_of_kin", "nextOfKin"] },
  { title: "Identifications", tabLabel: "IDs", keys: ["identifications", "identification_documents", "identificationDocuments"] },
  { title: "Bank Accounts", tabLabel: "Banks", keys: ["bank_accounts", "bankAccounts"] },
  { title: "Departments", tabLabel: "Depts", keys: ["departments", "department_assignments", "departmentAssignments"] },
  { title: "Academic Qualifications", tabLabel: "Academic", keys: ["academic_qualifications", "academicQualifications"] },
  { title: "Professional Qualifications", tabLabel: "Professional", keys: ["professional_qualifications", "professionalQualifications"] },
  { title: "Experience Details", tabLabel: "Experience", keys: ["experience_details", "experienceDetails"] },
  { title: "Company User", tabLabel: "User", keys: [], special: "company_user" },
]

function resolveProfileSectionItems(employee: AdminRecord, def: (typeof PROFILE_SECTION_DEFS)[number]) {
  if (def.special === "company_user") {
    return firstRecordArray(
      employee.company_user ? [asRecord(employee.company_user) ?? {}] : [],
      employee.companyUser ? [asRecord(employee.companyUser) ?? {}] : []
    )
  }
  return getProfileSectionItems(employee, def.keys)
}

function ProfileSectionsTabs({
  employee,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  employee: AdminRecord
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sections = React.useMemo(
    () =>
      PROFILE_SECTION_DEFS.map((def) => {
        const items = resolveProfileSectionItems(employee, def)
        return {
          title: def.title,
          tabLabel: def.tabLabel,
          routeKey: sectionTitleToRouteKey(def.title),
          items,
          count: items.length,
        }
      }),
    [employee]
  )

  const requestedTitle = routeKeyToSectionTitle(requestedRouteKey)
  const [activeTitle, setActiveTitle] = React.useState(
    () => requestedTitle ?? sections[0]?.title ?? "Contacts"
  )

  React.useEffect(() => {
    if (requestedTitle) {
      setActiveTitle(requestedTitle)
    }
  }, [requestedTitle])

  const active = sections.find((section) => section.title === activeTitle) ?? sections[0]
  const tabsScrollRef = React.useRef<HTMLDivElement | null>(null)
  const [tabScrollState, setTabScrollState] = React.useState({
    canScrollLeft: false,
    canScrollRight: false,
    scrollable: false,
  })

  const updateTabScrollState = React.useCallback(() => {
    const element = tabsScrollRef.current
    if (!element) {
      setTabScrollState({ canScrollLeft: false, canScrollRight: false, scrollable: false })
      return
    }

    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
    const next = {
      canScrollLeft: element.scrollLeft > 2,
      canScrollRight: element.scrollLeft < maxScrollLeft - 2,
      scrollable: maxScrollLeft > 2,
    }

    setTabScrollState((current) =>
      current.canScrollLeft === next.canScrollLeft &&
      current.canScrollRight === next.canScrollRight &&
      current.scrollable === next.scrollable
        ? current
        : next
    )
  }, [])

  React.useEffect(() => {
    const element = tabsScrollRef.current
    updateTabScrollState()
    if (!element) {
      return
    }

    const handleScrollUpdate = () => updateTabScrollState()
    element.addEventListener("scroll", handleScrollUpdate, { passive: true })
    window.addEventListener("resize", handleScrollUpdate)
    const frameId = window.requestAnimationFrame(updateTabScrollState)

    return () => {
      element.removeEventListener("scroll", handleScrollUpdate)
      window.removeEventListener("resize", handleScrollUpdate)
      window.cancelAnimationFrame(frameId)
    }
  }, [sections.length, updateTabScrollState])

  const scrollTabs = React.useCallback((direction: "left" | "right") => {
    const element = tabsScrollRef.current
    if (!element) {
      return
    }

    const distance = Math.max(element.clientWidth * 0.65, 140)
    element.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    })
    window.setTimeout(updateTabScrollState, 260)
  }, [updateTabScrollState])

  return (
    <div className="space-y-3">
      {/* Mirrors the compact Employees top tabs while keeping this rail horizontally scrollable. */}
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          aria-label="Scroll profile sections left"
          disabled={!tabScrollState.canScrollLeft}
          onClick={() => scrollTabs("left")}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary shadow-sm transition hover:border-primary/45 hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:border-border/60 disabled:bg-muted/30 disabled:text-muted-foreground disabled:opacity-45"
        >
          <ChevronLeftIcon className="size-3.5" />
        </button>
        <div
          ref={tabsScrollRef}
          className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Employee profile sections"
        >
          <div className="inline-flex min-w-full items-center gap-5 border-b border-border/80 sm:gap-6">
            {sections.map((section) => {
              const isActive = section.title === active?.title
              const needsAttention = requestedRouteKey === section.routeKey
              return (
                <button
                  key={section.routeKey}
                  type="button"
                  role="tab"
                  title={`${section.title} (${section.count})`}
                  aria-label={`${section.title}, ${section.count} items`}
                  aria-selected={isActive}
                  onClick={() => setActiveTitle(section.title)}
                  className={cn(
                    "-mb-px inline-flex h-8 shrink-0 items-center border-b-2 px-0 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                    isActive
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                    needsAttention && !isActive ? "text-amber-700 dark:text-amber-300" : null
                  )}
                >
                  {section.tabLabel}
                  <span
                    className={cn(
                      "ml-1 text-[11px] tabular-nums",
                      section.count === 0
                        ? "text-rose-600 dark:text-rose-400"
                        : isActive
                          ? "text-[var(--primary)]"
                          : "text-muted-foreground"
                    )}
                  >
                    {section.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          aria-label="Scroll profile sections right"
          disabled={!tabScrollState.canScrollRight}
          onClick={() => scrollTabs("right")}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary shadow-sm transition hover:border-primary/45 hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:border-border/60 disabled:bg-muted/30 disabled:text-muted-foreground disabled:opacity-45"
        >
          <ChevronRightIcon className="size-3.5" />
        </button>
      </div>

      {active ? (
        <Section
          key={active.routeKey}
          title={active.title}
          items={active.items}
          employeeId={employeeId}
          onMutated={onMutated}
          requestedRouteKey={requestedRouteKey}
        />
      ) : null}
    </div>
  )
}

function Section({
  title,
  items,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  title: string
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const [editingRecord, setEditingRecord] = React.useState<{ item: AdminRecord; index: number } | null>(null)
  const [deletingRecord, setDeletingRecord] = React.useState<{ item: AdminRecord; index: number } | null>(null)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [editForm, setEditForm] = React.useState<Record<string, string>>({})
  const [addForm, setAddForm] = React.useState<Record<string, string>>({})
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const token = readStoredToken()
  const apiSection = sectionTitleToApiSection(title)
  const isDocumentsSection = title.toLowerCase() === "documents"
  const routeKey = sectionTitleToRouteKey(title)
  const isHighlighted = requestedRouteKey === routeKey
  const supportsMutations = Boolean((apiSection || isDocumentsSection) && employeeId)
  const supportsAdd = supportsMutations
  const supportsDelete = supportsMutations
  const supportsEdit = Boolean(apiSection && !isDocumentsSection)

  React.useEffect(() => {
    if (!editingRecord) {
      setEditForm({})
      return
    }
    const initial = Object.fromEntries(
      editableEntries(editingRecord.item, title).map((entry) => [entry.key, entry.value])
    )
    setEditForm(initial)
  }, [editingRecord, title])

  const templateEntries = React.useMemo(() => {
    return sectionSchema(title)
  }, [title])

  React.useEffect(() => {
    if (!addingRecord) {
      setAddForm({})
      return
    }
    const initial = Object.fromEntries(templateEntries.map((entry) => [entry.key, entry.value]))
    setAddForm(initial)
  }, [addingRecord, templateEntries])

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label={`${title} section`}
        className={cn(
          "scroll-mt-24 rounded-xl px-3 py-3 outline-none transition-all duration-500 lg:px-4",
          isHighlighted && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background bg-amber-50/80 shadow-sm"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{title}</span>
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                items.length === 0
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                  : "bg-primary/10 text-primary"
              )}
            >
              {items.length}
            </span>
            {items.length === 0 ? (
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Not provided</span>
            ) : null}
            {isHighlighted ? (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Needs attention
              </span>
            ) : null}
          </div>
          {supportsAdd ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-3.5" /> Add
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={`${title}-${index}`} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-foreground">{recordPreview(item)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {supportsEdit ? (
                      <button
                        type="button"
                        aria-label={`Edit ${title} record ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingRecord({ item, index })}
                      >
                        <PencilIcon className="size-4" />
                      </button>
                    ) : null}
                    {supportsDelete ? (
                      <button
                        type="button"
                        aria-label={`Delete ${title} record ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setDeletingRecord({ item, index })}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  {renderRecordFields(item, title)
                    .filter((entry) => entry.value.trim() !== "" && entry.value !== "-" && entry.value !== "Available")
                    .map((entry) => (
                      <div key={`${title}-${index}-${entry.label}`} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {entry.label}
                        </p>
                        {entry.label.toLowerCase().includes("country") ? (
                          <span className="inline-flex items-center gap-1 break-words text-foreground">
                            {(() => {
                              const option = findCountryOption(entry.value)
                              if (!option) {
                                return null
                              }
                              const Flag = (FlagIcons as Record<string, React.ComponentType<{ title?: string; className?: string }>>)[option.code]
                              return Flag ? <Flag className="h-3 w-4 rounded-sm border border-border" /> : null
                            })()}
                            <span>{entry.value}</span>
                          </span>
                        ) : (
                          <p className="break-words text-foreground">{entry.value}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRecord(null)
            setMutationError(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit {title} Record</AlertDialogTitle>
            <AlertDialogDescription>
              Update the selected {title.toLowerCase()} information for this employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {editingRecord
              ? editableEntries(editingRecord.item, title).map((entry) => (
                  <div key={entry.key} className={entry.key === "responsibilities_description" || entry.key === "notes" ? "sm:col-span-2" : ""}>
                    {renderEntryInput({
                      entry,
                      value: editForm[entry.key] ?? entry.value,
                      onChange: (value) => {
                        setEditForm((current) => ({ ...current, [entry.key]: value }))
                      },
                    })}
                  </div>
                ))
              : null}
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Close</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !editingRecord || !supportsEdit}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={async () => {
                if (!editingRecord || !apiSection || !employeeId || !token) {
                  return
                }
                const itemId = readNumber(editingRecord.item.id)
                if (itemId === null) {
                  setMutationError("Missing record id; cannot update this item.")
                  return
                }
                const payload: AdminRecord = {}
                for (const entry of editableEntries(editingRecord.item, title)) {
                  const raw = editForm[entry.key] ?? entry.value
                  payload[entry.key] = entry.kind === "boolean" ? raw === "true" : raw
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (!apiSection) {
                    setMutationError("Edit is not supported for this section.")
                    return
                  }
                  await patchEmployeeSectionItem(token, employeeId, apiSection, itemId, payload)
                  setEditingRecord(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to update record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRecord(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {title.toLowerCase()} record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={!supportsDelete || submitting}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
              onClick={async () => {
                if (!deletingRecord || !employeeId || !token) {
                  return
                }
                const itemId = readNumber(deletingRecord.item.id)
                if (itemId === null) {
                  setMutationError("Missing record id; cannot delete this item.")
                  return
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (isDocumentsSection) {
                    await deleteEmployeeDocument(token, employeeId, itemId)
                  } else if (apiSection) {
                    await deleteEmployeeSectionItem(token, employeeId, apiSection, itemId)
                  } else {
                    setMutationError("Delete is not supported for this section.")
                    return
                  }
                  setDeletingRecord(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to delete record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={addingRecord}
        onOpenChange={(open) => {
          if (!open) {
            setAddingRecord(false)
          }
        }}
      >
        <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Add {title} Record</AlertDialogTitle>
            <AlertDialogDescription>
              Fill in the details to create a new {title.toLowerCase()} record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {templateEntries.length === 0 ? (
              <p className="text-sm text-slate-500 md:col-span-2">
                Add form is not yet configured for this section.
              </p>
            ) : (
              templateEntries.map((entry) => (
                <label key={`add-${title}-${entry.key}`} className="grid min-w-0 gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.label}</span>
                  {renderEntryInput({
                    entry,
                    value: addForm[entry.key] ?? entry.value,
                    onChange: (nextValue) => setAddForm((prev) => ({ ...prev, [entry.key]: nextValue })),
                  })}
                </label>
              ))
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !supportsAdd || templateEntries.length === 0}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={async () => {
                if (!employeeId || !token || templateEntries.length === 0) {
                  return
                }
                const payload: AdminRecord = {}
                for (const entry of templateEntries) {
                  const raw = addForm[entry.key] ?? entry.value
                  payload[entry.key] = entry.kind === "boolean" ? raw === "true" : raw
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (isDocumentsSection) {
                    await createEmployeeDocument(token, employeeId, payload)
                  } else if (apiSection) {
                    await createEmployeeSectionItem(token, employeeId, apiSection, payload)
                  } else {
                    setMutationError("Add is not supported for this section.")
                    return
                  }
                  setAddingRecord(false)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to add record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function EmployeeProfilePage({
  employeeNo,
  requestedMissingItem,
}: {
  employeeNo: string
  requestedMissingItem?: string | null
}) {
  const router = useRouter()
  const [employee, setEmployee] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [identityDialogOpen, setIdentityDialogOpen] = React.useState(false)
  const [identitySubmitting, setIdentitySubmitting] = React.useState(false)
  const [identityError, setIdentityError] = React.useState<string | null>(null)
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [profilePassword, setProfilePassword] = React.useState("")
  const [showProfilePassword, setShowProfilePassword] = React.useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false)
  const [statusSubmitting, setStatusSubmitting] = React.useState(false)
  const [statusError, setStatusError] = React.useState<string | null>(null)
  const [statusForm, setStatusForm] = React.useState<EmployeeStatusFormState>({
    employment_status: "active",
    exit_date: "",
    exit_reason: "",
    notes: "",
  })
  const [profileSearchOpen, setProfileSearchOpen] = React.useState(false)
  const [profileSearch, setProfileSearch] = React.useState("")
  const [profileSearchResults, setProfileSearchResults] = React.useState<AdminRecord[]>([])
  const [profileSearchLoading, setProfileSearchLoading] = React.useState(false)
  const [profileSearchError, setProfileSearchError] = React.useState<string | null>(null)
  const isExitedStatus = statusForm.employment_status === "exited"
  const requestedSectionTitle = React.useMemo(
    () => routeKeyToSectionTitle(requestedMissingItem),
    [requestedMissingItem]
  )
  const requestedRouteKey = React.useMemo(
    () => (requestedSectionTitle ? sectionTitleToRouteKey(requestedSectionTitle) : null),
    [requestedSectionTitle]
  )

  const fetchEmployee = React.useCallback(async () => {
      const token = readStoredToken()
      if (!token) {
        setError("Authentication required. Please log in again.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const decodedNo = decodeURIComponent(employeeNo)
        const result = await listEmployees(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          search: decodedNo,
        })

        const matched = result.rows.find(
          (row) =>
            readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"]) === decodedNo
        )
        if (!matched) {
          setError("Employee not found.")
          setEmployee(null)
        } else {
          const employeeId = readNumber(matched.id)
          if (employeeId === null) {
            setEmployee(mergeEmployeeProfileRecord(matched))
          } else {
            const detailedEmployee = await getEmployeeById(employeeId, token).catch(() => null)
            setEmployee(mergeEmployeeProfileRecord(detailedEmployee ?? matched))
          }
        }
      } catch (errorObject) {
        setError(errorObject instanceof Error ? errorObject.message : "Failed to load employee profile.")
      } finally {
        setLoading(false)
      }
    }, [employeeNo])

  React.useEffect(() => {
    void fetchEmployee()
  }, [fetchEmployee])

  React.useEffect(() => {
    if (!profileSearchOpen) {
      setProfileSearch("")
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      setProfileSearchError(null)
      return
    }

    const trimmedSearch = profileSearch.trim()
    if (trimmedSearch.length < 2) {
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      setProfileSearchError(null)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setProfileSearchError("Authentication required. Please log in again.")
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      return
    }

    let cancelled = false
    setProfileSearchLoading(true)
    setProfileSearchError(null)

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await listEmployees(token, {
          page: 1,
          limit: 8,
          sortBy: "created_at",
          sortOrder: "DESC",
          search: trimmedSearch,
        })
        if (cancelled) {
          return
        }
        setProfileSearchResults(result.rows)
      } catch (errorObject) {
        if (cancelled) {
          return
        }
        setProfileSearchResults([])
        setProfileSearchError(errorObject instanceof Error ? errorObject.message : "Failed to search employees.")
      } finally {
        if (!cancelled) {
          setProfileSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [profileSearch, profileSearchOpen])

  function openEmployeeProfile(row: AdminRecord) {
    const nextEmployeeNo = readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"])
    if (nextEmployeeNo === "-") {
      return
    }
    setProfileSearchOpen(false)
    router.push(`/dashboard/employees/profile/${encodeURIComponent(nextEmployeeNo)}`)
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">Loading employee profile...</div>
  }

  if (error || !employee) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/80 p-6 dark:border-slate-700 dark:bg-slate-900/60">
        <p className="text-sm text-rose-600">{error ?? "Employee not found."}</p>
        <button
          type="button"
          className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
          onClick={() => router.push("/dashboard/employees/all")}
        >
          Back to All Employees
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 pb-4 lg:px-6">
      <div className="sticky top-3 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">{employeeDisplayNameFromLinkedUser(employee)}</h2>
            <Popover open={profileSearchOpen} onOpenChange={setProfileSearchOpen}>
              <PopoverTrigger
                type="button"
                aria-label="Search employee profiles"
                title="Search employee profiles"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                <SearchIcon className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[340px] p-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Find Another Employee</p>
                    <p className="text-xs text-muted-foreground">Search by name, employee number, email, or phone.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                    <SearchIcon className="size-4 shrink-0 text-slate-400" />
                    <input
                      type="text"
                      value={profileSearch}
                      onChange={(event) => setProfileSearch(event.target.value)}
                      placeholder="Search employee profile"
                      className="h-10 w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {profileSearchError ? <p className="text-xs text-rose-600">{profileSearchError}</p> : null}
                  {profileSearchLoading ? <p className="text-xs text-muted-foreground">Searching employees...</p> : null}
                  {!profileSearchLoading && !profileSearchError && profileSearch.trim().length > 0 && profileSearch.trim().length < 2 ? (
                    <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
                  ) : null}
                  {!profileSearchLoading && !profileSearchError && profileSearch.trim().length >= 2 && profileSearchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No employees matched your search.</p>
                  ) : null}
                  {profileSearchResults.length > 0 ? (
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {profileSearchResults.map((row, index) => {
                        const nextEmployeeNo = readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"])
                        return (
                          <button
                            key={`${nextEmployeeNo}-${index}`}
                            type="button"
                            className="flex w-full items-start justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => openEmployeeProfile(row)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">{employeeDisplayNameFromLinkedUser(row)}</span>
                              <span className="block truncate text-xs text-muted-foreground">{readString(row, ["email", "work_email", "personal_email"])}</span>
                            </span>
                            <span className="shrink-0 pl-3 text-xs text-muted-foreground">{nextEmployeeNo}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                const companyUser = resolveCompanyUserRecord(employee)
                setFirstName(readString(companyUser ?? employee, ["first_name", "firstName"]) === "-" ? "" : readString(companyUser ?? employee, ["first_name", "firstName"]))
                setLastName(readString(companyUser ?? employee, ["last_name", "lastName"]) === "-" ? "" : readString(companyUser ?? employee, ["last_name", "lastName"]))
                setUsername(readString(companyUser ?? {}, ["username", "user_no"]) === "-" ? "" : readString(companyUser ?? {}, ["username", "user_no"]))
                setEmail(readString(companyUser ?? {}, ["email"]) === "-" ? "" : readString(companyUser ?? {}, ["email"]))
                setProfilePassword("")
                setShowProfilePassword(false)
                setIdentityError(null)
                setIdentityDialogOpen(true)
              }}
            >
              Update Profile
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                setStatusForm(readEmployeeStatusForm(employee))
                setStatusError(null)
                setStatusDialogOpen(true)
              }}
            >
              Update Status
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {(() => {
          const employeeNo = readString(employee, [
            "employee_no",
            "employeeNo",
            "user_no",
            "employee_number",
            "employeeNumber",
          ])
          const statusRaw = readString(employee, [
            "employment_status",
            "employmentStatus",
            "status",
          ])
          const employmentType = formatLabelValue(
            readString(employee, ["employment_type", "employmentType"])
          )
          const branch =
            readString(employee, ["branch_name", "branchName"]) !== "-"
              ? readString(employee, ["branch_name", "branchName"])
              : readNestedString(employee.primary_branch ?? employee.branch, [
                  "name",
                  "branch_name",
                  "branchName",
                ])
          const department =
            readString(employee, ["department_name", "departmentName"]) !== "-"
              ? readString(employee, ["department_name", "departmentName"])
              : readNestedString(employee.primary_department ?? employee.department, [
                  "name",
                  "department_name",
                  "departmentName",
                ])
          const position =
            readString(employee, ["position_name", "positionName"]) !== "-"
              ? readString(employee, ["position_name", "positionName"])
              : readNestedString(employee.primary_position ?? employee.position, [
                  "name",
                  "position_name",
                  "positionName",
                ])
          const manager =
            readString(employee, ["manager_name", "managerName"]) !== "-"
              ? readString(employee, ["manager_name", "managerName"])
              : employeeDisplayName(asRecord(employee.manager) ?? {})

          return (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              <SummaryField label="Employee No" value={employeeNo} />
              <SummaryField label="Status">
                <span className={cn("text-sm font-medium", statusTone(statusRaw))}>
                  {formatLabelValue(statusRaw)}
                </span>
              </SummaryField>
              <SummaryField label="Employment Type" value={employmentType} />
              <SummaryField
                label="Hire Date"
                value={formatProfileDate(employee.hire_date ?? employee.hireDate)}
              />
              <SummaryField label="Branch" value={branch} />
              <SummaryField label="Department" value={department} />
              <SummaryField label="Position" value={position} />
              <SummaryField label="Manager" value={manager} />
              <SummaryField
                label="Last Updated"
                value={formatDateTime(employee.updated_at ?? employee.updatedAt)}
              />
              <SummaryField label="Employee Id" value={String(employee.id ?? "-")} />
            </dl>
          )
        })()}
      </div>

      <ProfileSectionsTabs
        employee={employee}
        employeeId={readNumber(employee.id)}
        onMutated={fetchEmployee}
        requestedRouteKey={requestedRouteKey}
      />

      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Update Employee Status</AlertDialogTitle>
            <AlertDialogDescription>Update lifecycle status and optional exit details.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employment Status</span>
              <select
                value={statusForm.employment_status}
                onChange={(event) =>
                  setStatusForm((prev) => {
                    const nextStatus = normalizeEmployeeStatus(event.target.value)
                    if (nextStatus === "exited") {
                      return { ...prev, employment_status: nextStatus }
                    }
                    return {
                      ...prev,
                      employment_status: nextStatus,
                      exit_date: "",
                      exit_reason: "",
                    }
                  })
                }
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                {EMPLOYEE_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className={`grid min-w-0 gap-1 ${isExitedStatus ? "" : "opacity-60"}`}>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exit Date</span>
              {isExitedStatus ? (
                <DatePickerPresets
                  value={statusForm.exit_date}
                  onChange={(value) => setStatusForm((prev) => ({ ...prev, exit_date: value }))}
                />
              ) : (
                <input
                  value=""
                  readOnly
                  disabled
                  placeholder="Only for exited status"
                  className="h-10 w-full rounded-md border border-slate-300 bg-slate-100 px-3 text-xs text-slate-500"
                />
              )}
            </label>
            <label className={`grid min-w-0 gap-1 ${isExitedStatus ? "" : "opacity-60"}`}>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exit Reason</span>
              <input
                value={statusForm.exit_reason}
                onChange={(event) => setStatusForm((prev) => ({ ...prev, exit_reason: event.target.value }))}
                disabled={!isExitedStatus}
                placeholder={isExitedStatus ? "" : "Only for exited status"}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-100 disabled:text-xs disabled:text-slate-500"
              />
            </label>
            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span>
              <Textarea
                value={statusForm.notes}
                onChange={(event) => setStatusForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          {statusError ? <p className="text-sm text-rose-600">{statusError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={statusSubmitting || readNumber(employee.id) === null}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={async () => {
                const employeeId = readNumber(employee.id)
                const token = readStoredToken()
                if (employeeId === null || !token) {
                  return
                }
                const validationError = validateStatusForm(statusForm)
                if (validationError) {
                  setStatusError(validationError)
                  return
                }

                const payload: EmployeeStatusPayload = {
                  employment_status: statusForm.employment_status,
                  exit_date: isExitedStatus ? statusForm.exit_date.trim() || undefined : undefined,
                  exit_reason: isExitedStatus ? statusForm.exit_reason.trim() || undefined : undefined,
                  notes: statusForm.notes.trim() || undefined,
                }
                setStatusSubmitting(true)
                setStatusError(null)
                try {
                  await patchEmployeeStatus(token, employeeId, payload)
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(EMPLOYEE_STATUS_REFRESH_KEY, String(Date.now()))
                    window.dispatchEvent(new CustomEvent(EMPLOYEE_STATUS_REFRESH_EVENT))
                  }
                  setStatusDialogOpen(false)
                  await fetchEmployee()
                } catch (errorObject) {
                  setStatusError(errorObject instanceof Error ? errorObject.message : "Failed to update status.")
                } finally {
                  setStatusSubmitting(false)
                }
              }}
            >
              {statusSubmitting ? "Saving..." : "Save"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={identityDialogOpen} onOpenChange={setIdentityDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Update Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Update full name, username, email, and password for this employee account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">First Name</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Enter first name"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Name</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Enter last name"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Enter username"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Enter email"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                New Password (Optional)
              </span>
              <div className="relative">
                <input
                  type={showProfilePassword ? "text" : "password"}
                  value={profilePassword}
                  onChange={(event) => setProfilePassword(event.target.value)}
                  minLength={6}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-sm"
                  placeholder="Leave blank to keep current password"
                />
                <button
                  type="button"
                  aria-label={showProfilePassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  onClick={() => setShowProfilePassword((prev) => !prev)}
                >
                  {showProfilePassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>
          {identityError ? <p className="text-sm text-rose-600">{identityError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={identitySubmitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={identitySubmitting}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={async () => {
                const token = readStoredToken()
                const userId = resolveCompanyUserId(employee)
                const trimmedFirstName = firstName.trim()
                const trimmedLastName = lastName.trim()
                const trimmedUsername = username.trim()
                const trimmedEmail = email.trim()
                const trimmedPassword = profilePassword.trim()

                if (!token) {
                  setIdentityError("Authentication required. Please log in again.")
                  return
                }
                if (userId === null) {
                  setIdentityError("No linked user account found for this employee.")
                  return
                }
                if (!trimmedFirstName) {
                  setIdentityError("First name is required.")
                  return
                }
                if (!trimmedLastName) {
                  setIdentityError("Last name is required.")
                  return
                }
                if (!trimmedUsername) {
                  setIdentityError("Username is required.")
                  return
                }
                if (!trimmedEmail) {
                  setIdentityError("Email is required.")
                  return
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                  setIdentityError("Please enter a valid email address.")
                  return
                }
                if (trimmedPassword && trimmedPassword.length < 6) {
                  setIdentityError("Password must be at least 6 characters.")
                  return
                }

                setIdentitySubmitting(true)
                setIdentityError(null)
                try {
                  const payload: AdminRecord = {
                    first_name: trimmedFirstName,
                    last_name: trimmedLastName,
                    user_no: trimmedUsername,
                    email: trimmedEmail,
                  }
                  if (trimmedPassword) {
                    payload.password = trimmedPassword
                  }
                  await updateUserById(userId, token, {
                    ...payload,
                  })
                  setIdentityDialogOpen(false)
                  await fetchEmployee()
                } catch (errorObject) {
                  setIdentityError(errorObject instanceof Error ? errorObject.message : "Failed to update user details.")
                } finally {
                  setIdentitySubmitting(false)
                }
              }}
            >
              {identitySubmitting ? "Updating..." : "Update Profile"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
