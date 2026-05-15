"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"
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
import { Accordion, AccordionPanel, AccordionItem, AccordionTrigger } from "@/components/animate-ui/components/base/accordion"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import {
  createEmployeeDocument,
  createEmployeeSectionItem,
  deleteEmployeeDocument,
  deleteEmployeeSectionItem,
  listEmployees,
  patchEmployeeStatus,
  patchEmployeeSectionItem,
  updateUserById,
  type AdminRecord,
  type EmployeeStatusPayload,
  type EmployeeProfileSection,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

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

function readNestedString(value: unknown, keys: string[]) {
  const record = asRecord(value)
  if (!record) {
    return "-"
  }
  return readString(record, keys)
}

function employeeDisplayName(row: AdminRecord) {
  const named = readString(row, ["full_name", "fullName", "name"])
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
    const userNamed = readString(companyUser, ["full_name", "fullName", "name"])
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
  return parsed.toLocaleString()
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 py-2 text-sm last:border-b-0 dark:border-slate-700/70">
      <span className="min-w-36 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</span>
      <span className="text-slate-900 dark:text-slate-100">{value}</span>
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
        <textarea
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

  if (entry.key === "file_url") {
    return <DocumentFileInput value={value} onChange={onChange} />
  }

  if (entry.key.includes("country")) {
    return <CountrySelectInput value={value} onChange={onChange} />
  }

  if (entry.key === "responsibilities_description" || entry.key === "notes") {
    return (
      <textarea
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
      { key: "professional_certificate_document_url", label: "Professional Certificate URL", value: "", kind: "text" },
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

function SectionAccordion({
  title,
  items,
  employeeId,
  onMutated,
}: {
  title: string
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
}) {
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

  return (
    <>
      <Accordion
        multiple={false}
        className="rounded-xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/40"
      >
        <AccordionItem value={title} className="rounded-none border-0 bg-transparent shadow-none">
          <AccordionTrigger showArrow={true}>
            <div className="flex items-center gap-2">
              <span>{title}</span>
              {items.length === 0 ? (
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Not provided</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">{items.length}</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionPanel keepRendered={true} className="border-t-0">
            {supportsMutations ? (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() => setAddingRecord(true)}
                >
                  <PlusIcon className="size-3.5" />
                  Add
                </button>
              </div>
            ) : null}
            {items.length === 0 ? (
              <p className="py-2 text-sm text-slate-500 dark:text-slate-400">No data available.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={`${title}-${index}`} className="rounded-lg p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900 break-words dark:text-slate-100">{recordPreview(item)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {supportsEdit ? (
                          <button
                          type="button"
                          aria-label={`Edit ${title} record ${index + 1}`}
                          className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
                          onClick={() => setEditingRecord({ item, index })}
                        >
                          <PencilIcon className="size-4" />
                        </button>
                        ) : null}
                        {supportsDelete ? (
                          <button
                          type="button"
                          aria-label={`Delete ${title} record ${index + 1}`}
                          className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15"
                          onClick={() => setDeletingRecord({ item, index })}
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {renderRecordFields(item, title)
                        .filter((entry) => entry.value.trim() !== "" && entry.value !== "-" && entry.value !== "Available")
                        .map((entry) => (
                          <div key={`${title}-${index}-${entry.label}`} className="min-w-0 rounded-md bg-slate-50/80 p-2.5 dark:bg-slate-800/40">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {entry.label}
                            </p>
                            {entry.label.toLowerCase().includes("country") ? (
                              <span className="inline-flex items-center gap-2 text-sm text-slate-800 break-words dark:text-slate-100">
                                {(() => {
                                  const option = findCountryOption(entry.value)
                                  if (!option) {
                                    return null
                                  }
                                  const Flag = (FlagIcons as Record<string, React.ComponentType<{ title?: string; className?: string }>>)[option.code]
                                  return Flag ? <Flag className="h-4 w-6 rounded-sm border border-slate-200 dark:border-slate-600" /> : null
                                })()}
                                <span>{entry.value}</span>
                              </span>
                            ) : (
                              <p className="text-sm text-slate-800 break-words dark:text-slate-100">{entry.value}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      <AlertDialog
        open={Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRecord(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Edit {title} Record {editingRecord ? `#${editingRecord.index + 1}` : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Edit form preview. Once you share the API contract, I will wire submit/update behavior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 lg:grid-cols-2">
            {(editingRecord ? editableEntries(editingRecord.item, title) : []).map((entry) => (
              <label key={`edit-${title}-${entry.key}`} className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.label}</span>
                {renderEntryInput({
                  entry,
                  value: editForm[entry.key] ?? entry.value,
                  onChange: (nextValue) => setEditForm((prev) => ({ ...prev, [entry.key]: nextValue })),
                })}
              </label>
            ))}
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !editingRecord || !supportsEdit}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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

export function EmployeeProfilePage({ employeeNo }: { employeeNo: string }) {
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
  const [statusForm, setStatusForm] = React.useState({
    employment_status: "active",
    exit_date: "",
    exit_reason: "",
    notes: "",
  })
  const isExitedStatus = statusForm.employment_status === "exited"

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

        const matched = result.rows.find((row) => readString(row, ["employee_no", "user_no"]) === decodedNo)
        if (!matched) {
          setError("Employee not found.")
          setEmployee(null)
        } else {
          setEmployee(matched)
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
      <div className="sticky top-3 z-30 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:px-6 dark:border-slate-700 dark:bg-slate-900/90">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{employeeDisplayNameFromLinkedUser(employee)}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Employee profile details</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-transparent p-0.5">
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
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
              className="rounded-md px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() => {
                setStatusForm({
                  employment_status: (readString(employee, ["employment_status"]) || "active") as "active",
                  exit_date: readString(employee, ["exit_date"]) === "-" ? "" : readString(employee, ["exit_date"]),
                  exit_reason: readString(employee, ["exit_reason"]) === "-" ? "" : readString(employee, ["exit_reason"]),
                  notes: readString(employee, ["notes"]) === "-" ? "" : readString(employee, ["notes"]),
                })
                setStatusError(null)
                setStatusDialogOpen(true)
              }}
            >
              Update Status
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() => router.push("/dashboard/employees/all")}
            >
              Back to All Employees
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm lg:px-6 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="grid gap-x-8 md:grid-cols-2">
          <div>
            <SummaryRow label="Employee No" value={readString(employee, ["employee_no", "user_no"])} />
            <SummaryRow label="Status" value={readString(employee, ["employment_status", "status"])} />
            <SummaryRow label="Employment Type" value={readString(employee, ["employment_type"])} />
            <SummaryRow label="Hire Date" value={readString(employee, ["hire_date"])} />
            <SummaryRow label="Branch" value={readNestedString(employee.primary_branch, ["name"])} />
          </div>
          <div>
            <SummaryRow label="Department" value={readNestedString(employee.primary_department, ["name"])} />
            <SummaryRow label="Position" value={readNestedString(employee.position, ["name"])} />
            <SummaryRow label="Manager" value={employeeDisplayName(asRecord(employee.manager) ?? {})} />
            <SummaryRow label="Last Updated" value={formatDateTime(employee.updated_at)} />
            <SummaryRow label="Employee Id" value={String(employee.id ?? "-")} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SectionAccordion title="Contacts" items={asRecordArray(employee.contacts)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Documents" items={asRecordArray(employee.documents)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Addresses" items={asRecordArray(employee.addresses)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Relatives" items={asRecordArray(employee.relatives)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Identifications" items={asRecordArray(employee.identifications)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Bank Accounts" items={asRecordArray(employee.bank_accounts)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Departments" items={asRecordArray(employee.departments)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Academic Qualifications" items={asRecordArray(employee.academic_qualifications)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Professional Qualifications" items={asRecordArray(employee.professional_qualifications)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Experience Details" items={asRecordArray(employee.experience_details)} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
        <SectionAccordion title="Company User" items={employee.company_user ? [asRecord(employee.company_user) ?? {}] : []} employeeId={readNumber(employee.id)} onMutated={fetchEmployee} />
      </div>

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
                    const nextStatus = event.target.value
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
                <option value="onboarding">onboarding</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="terminated">terminated</option>
                <option value="exited">exited</option>
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
              <textarea
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
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={async () => {
                const employeeId = readNumber(employee.id)
                const token = readStoredToken()
                if (employeeId === null || !token) {
                  return
                }
                const payload: EmployeeStatusPayload = {
                  employment_status: statusForm.employment_status as EmployeeStatusPayload["employment_status"],
                  exit_date: isExitedStatus ? statusForm.exit_date || undefined : undefined,
                  exit_reason: isExitedStatus ? statusForm.exit_reason || undefined : undefined,
                  notes: statusForm.notes || undefined,
                }
                setStatusSubmitting(true)
                setStatusError(null)
                try {
                  await patchEmployeeStatus(token, employeeId, payload)
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
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
