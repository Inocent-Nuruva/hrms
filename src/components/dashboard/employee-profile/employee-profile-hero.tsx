"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button as FluentButton } from "@fluentui/react-components"
import {
  ArrowLeft16Regular,
  Briefcase16Regular,
  Building16Regular,
  CalendarLtr16Regular,
  ChevronRight12Regular,
  Copy16Regular,
  Mail16Regular,
  Person16Regular,
  Phone16Regular,
} from "@fluentui/react-icons"

import { resolveBackendMediaUrl, type AdminRecord } from "@/lib/admin-api"
import { getEmployeeDirectoryContactSummary } from "@/lib/employee-directory-search"
import { cn } from "@/lib/utils"
import {
  asRecord,
  employeeDisplayName,
  employeeDisplayNameFromLinkedUser,
  formatDateTime,
  formatLabelValue,
  formatProfileDate,
  readNestedString,
  readString,
} from "@/components/dashboard/employee-profile/profile-shared"

const EMPLOYEE_NO_KEYS = ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"]
const PHOTO_KEYS = ["profile_photo_url", "profilePhotoUrl", "avatar_url", "avatarUrl", "photo_url"]

function pick(row: AdminRecord, flatKeys: string[], nested: unknown, nestedKeys: string[]) {
  const flat = readString(row, flatKeys)
  return flat !== "-" ? flat : readNestedString(nested, nestedKeys)
}

function photoUrl(row: AdminRecord) {
  const user = asRecord(row.user) ?? asRecord(row.company_user)
  const nestedUser = asRecord(user?.user)
  const value = [row, user, nestedUser]
    .map((record) => (record ? readString(record, PHOTO_KEYS) : "-"))
    .find((candidate) => candidate && candidate !== "-")
  return value ? resolveBackendMediaUrl(value) : null
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  )
}

function tenureLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const start = new Date(value)
  if (Number.isNaN(start.getTime())) return null
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) return "Starts soon"
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return rest <= 0 ? "Less than a month" : `${rest} mo`
  return rest ? `${years} yr ${rest} mo` : `${years} yr`
}

function statusPillClass(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
  if (["onboarding", "probation"].includes(normalized)) return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
  if (["suspended", "offboarding", "on_leave"].includes(normalized)) return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
  if (["terminated", "exited", "inactive"].includes(normalized)) return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
  return "border-border bg-muted text-muted-foreground"
}

function Fact({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string | null
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 px-4 py-3">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-semibold text-foreground" title={value}>
          {value}
        </dd>
        {hint ? <dd className="truncate text-xs text-muted-foreground">{hint}</dd> : null}
      </div>
    </div>
  )
}

export function EmployeeProfileHero({
  employee,
  searchSlot,
  onUpdateProfile,
  onUpdateStatus,
}: {
  employee: AdminRecord
  searchSlot?: React.ReactNode
  /** Omitted when the viewer lacks employees:update; the button is hidden. */
  onUpdateProfile?: () => void
  /** Omitted when the viewer lacks employees:change-status. */
  onUpdateStatus?: () => void
}) {
  const router = useRouter()
  const name = employeeDisplayNameFromLinkedUser(employee)
  const employeeNo = readString(employee, EMPLOYEE_NO_KEYS)
  const status = readString(employee, ["employment_status", "employmentStatus", "status"])
  const position = pick(employee, ["position_name", "positionName"], employee.primary_position ?? employee.position, ["name", "position_name", "positionName"])
  const department = pick(employee, ["department_name", "departmentName"], employee.primary_department ?? employee.department, ["name", "department_name", "departmentName"])
  const branch = pick(employee, ["branch_name", "branchName"], employee.primary_branch ?? employee.branch, ["name", "branch_name", "branchName"])
  const managerFlat = readString(employee, ["manager_name", "managerName"])
  const manager = managerFlat !== "-" ? managerFlat : employeeDisplayName(asRecord(employee.manager) ?? {})
  const employmentType = formatLabelValue(readString(employee, ["employment_type", "employmentType"]))
  const hireValue = employee.hire_date ?? employee.hireDate
  const contact = getEmployeeDirectoryContactSummary(employee) ?? {}
  const email = typeof contact.email === "string" ? contact.email : null
  const phone = typeof contact.phone_number === "string" ? contact.phone_number : null
  const photo = photoUrl(employee)
  const [photoFailed, setPhotoFailed] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const goBack = () => {
    const cameFromApp =
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin)
    if (cameFromApp) router.back()
    else router.push("/dashboard/employees/all")
  }

  const copyEmployeeNo = async () => {
    try {
      await navigator.clipboard.writeText(employeeNo)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="border-b border-border bg-background">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft16Regular />
            Back
          </button>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Link href="/dashboard/employees/all" className="hover:text-foreground hover:underline">
              Employees
            </Link>
            <ChevronRight12Regular />
            <span className="truncate font-medium text-foreground">{name}</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {searchSlot}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative shrink-0">
            {photo && !photoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="size-16 rounded-full border border-border object-cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {initials(name)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-foreground">{name}</h1>
              {status !== "-" ? (
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", statusPillClass(status))}>
                  <span className="size-1.5 rounded-full bg-current" />
                  {formatLabelValue(status)}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {[position, department].filter((value) => value && value !== "-").join(" · ") || "No position assigned"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {employeeNo !== "-" ? (
                <button
                  type="button"
                  onClick={copyEmployeeNo}
                  className="inline-flex items-center gap-1 font-mono hover:text-foreground"
                  title="Copy employee number"
                >
                  {employeeNo}
                  <Copy16Regular className="size-3.5" />
                  {copied ? <span className="font-sans text-emerald-600">Copied</span> : null}
                </button>
              ) : null}
              {email ? (
                <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                  <Mail16Regular className="size-3.5" />
                  {email}
                </a>
              ) : null}
              {phone ? (
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                  <Phone16Regular className="size-3.5" />
                  {phone}
                </a>
              ) : null}
            </div>
          </div>
        </div>
        {onUpdateStatus || onUpdateProfile ? (
          <div className="flex shrink-0 items-center gap-2">
            {onUpdateStatus ? (
              <FluentButton appearance="secondary" onClick={onUpdateStatus}>
                Update status
              </FluentButton>
            ) : null}
            {onUpdateProfile ? (
              <FluentButton appearance="primary" onClick={onUpdateProfile}>
                Update profile
              </FluentButton>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <Fact
          icon={<CalendarLtr16Regular />}
          label="Hired"
          value={formatProfileDate(hireValue)}
          hint={tenureLabel(hireValue)}
        />
        <Fact icon={<Briefcase16Regular />} label="Employment type" value={employmentType} hint={position !== "-" ? position : null} />
        <Fact icon={<Building16Regular />} label="Location" value={branch} hint={department !== "-" ? department : null} />
        <Fact
          icon={<Person16Regular />}
          label="Reports to"
          value={manager && manager !== "-" ? manager : "Not set"}
          hint={`Updated ${formatDateTime(employee.updated_at ?? employee.updatedAt)}`}
        />
      </dl>
    </div>
  )
}
