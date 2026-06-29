"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  CircleHelpIcon,
  CreditCardIcon,
  Fingerprint as FingerprintIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  QrCodeIcon,
  RefreshCwIcon,
  ScanFaceIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { TableScrollContainer } from "@/components/common/table-scroll-container"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  assignEmployeeDevices,
  captureEmployeeDeviceFingerprint,
  createEmployeeDevicePassword,
  deleteEmployeeDeviceFingerprint,
  disableEmployeeDeviceFingerprint,
  enableEmployeeDeviceFingerprint,
  getAccessControlAttendanceDeviceSyncStatus,
  getAttendanceDeviceSyncStatus,
  getAttendanceResourceById,
  listAccessControlResources,
  listAttendanceDeviceAssignmentMatches,
  listAttendanceDeviceEmployees,
  listEmployeeDeviceFingerprints,
  listEmployees,
  removeEmployeeDeviceAssignment,
  registerEmployeeDeviceUser,
  resyncEmployeeDeviceFingerprint,
  resyncEmployeeDeviceUser,
  syncAccessControlDeviceDoors,
  syncAccessControlDeviceTemplates,
  syncAccessControlDeviceWeekPlans,
  syncHikvisionDeviceFingerprints,
  syncHikvisionDeviceUsers,
  syncEmployeeDeviceFingerprint,
  syncAttendanceDevice,
  testAttendanceDeviceConnection,
  updateEmployeeDeviceUser,
  updateEmployeeDevicePassword,
  type AdminRecord,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type DeviceTabKey = "details" | "employees" | "sync"
type DeviceSyncStepKey = "core" | "doors" | "templates" | "week-plans" | "users" | "fingerprints"
type DeviceSyncStepState = "idle" | "running" | "success" | "error"
type CredentialTypeValue = "CARD" | "FINGERPRINT" | "FACE" | "PASSWORD" | "QR" | "PIN"
type DeviceSyncStatus = Record<
  DeviceSyncStepKey,
  {
    state: DeviceSyncStepState
    message?: string
  }
>

type CredentialTypeChoice = {
  value: CredentialTypeValue
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  enabled: boolean
}

type FingerprintOption = {
  id: string
  label: string
  shortLabel: string
  hand: "left" | "right"
  top: string
  left: string
}

type FingerprintSlotSummary = {
  id: string
  label: string
  recordId: string
  slotNo: number | null
  enabled: boolean
  status: string
}

type FingerSelectorHint = {
  text: string
  tone: "info" | "warning"
}

type FingerprintCaptureDialogState = {
  employeeName: string
  fingerprintLabel: string
}

type CredentialAlertState = {
  title: string
  message: string
}

type DeviceUserMatchOption = {
  employeeNo: string
  label: string
  detail: string | null
}

const FINGERPRINT_OPTIONS: FingerprintOption[] = [
  { id: "1", label: "Left Thumb", shortLabel: "Thumb", hand: "left", top: "58%", left: "2%" },
  { id: "2", label: "Left Index", shortLabel: "Index", hand: "left", top: "8%", left: "18%" },
  { id: "3", label: "Left Middle", shortLabel: "Middle", hand: "left", top: "0%", left: "36%" },
  { id: "4", label: "Left Ring", shortLabel: "Ring", hand: "left", top: "8%", left: "54%" },
  { id: "5", label: "Left Little", shortLabel: "Little", hand: "left", top: "18%", left: "72%" },
  { id: "6", label: "Right Thumb", shortLabel: "Thumb", hand: "right", top: "58%", left: "76%" },
  { id: "7", label: "Right Index", shortLabel: "Index", hand: "right", top: "8%", left: "60%" },
  { id: "8", label: "Right Middle", shortLabel: "Middle", hand: "right", top: "0%", left: "42%" },
  { id: "9", label: "Right Ring", shortLabel: "Ring", hand: "right", top: "8%", left: "24%" },
  { id: "10", label: "Right Little", shortLabel: "Little", hand: "right", top: "18%", left: "6%" },
]

const USER_VERIFY_MODE_OPTIONS = [
  { value: "fpOrCard", label: "Fingerprint Or Card" },
  { value: "card", label: "Card Only" },
  { value: "fp", label: "Fingerprint Only" },
  { value: "cardAndPw", label: "Card And Password" },
  { value: "fpAndCard", label: "Fingerprint And Card" },
  { value: "fpAndPw", label: "Fingerprint And Password" },
  { value: "fpAndCardAndPw", label: "Fingerprint, Card And Password" },
  { value: "cardOrFpOrPw", label: "Card Or Fingerprint Or Password" },
] as const

const USER_VERIFY_MODE_CREDENTIAL_MAP: Record<string, CredentialTypeValue[]> = {
  fpOrCard: ["FINGERPRINT", "CARD"],
  card: ["CARD"],
  fp: ["FINGERPRINT"],
  cardAndPw: ["CARD", "PASSWORD", "PIN"],
  fpAndCard: ["FINGERPRINT", "CARD"],
  fpAndPw: ["FINGERPRINT", "PASSWORD", "PIN"],
  fpAndCardAndPw: ["FINGERPRINT", "CARD", "PASSWORD", "PIN"],
  cardOrFpOrPw: ["CARD", "FINGERPRINT", "PASSWORD", "PIN"],
}

const CREDENTIAL_TYPE_CHOICES: CredentialTypeChoice[] = [
  {
    value: "CARD",
    label: "Card",
    icon: CreditCardIcon,
    description: "Use a physical access card.",
    enabled: false,
  },
  {
    value: "FINGERPRINT",
    label: "Fingerprint",
    icon: FingerprintIcon,
    description: "Capture a finger from the device.",
    enabled: true,
  },
  {
    value: "FACE",
    label: "Face",
    icon: ScanFaceIcon,
    description: "Use face credentials.",
    enabled: false,
  },
  {
    value: "PASSWORD",
    label: "Password",
    icon: KeyRoundIcon,
    description: "Set a device password.",
    enabled: true,
  },
  {
    value: "PIN",
    label: "PIN",
    icon: KeyRoundIcon,
    description: "Set a device PIN.",
    enabled: true,
  },
  {
    value: "QR",
    label: "QR",
    icon: QrCodeIcon,
    description: "Use a QR credential.",
    enabled: false,
  },
]

function buildInitialDeviceSyncStatus(): DeviceSyncStatus {
  return {
    core: { state: "idle", message: "Not started." },
    doors: { state: "idle", message: "Not started." },
    templates: { state: "idle", message: "Not started." },
    "week-plans": { state: "idle", message: "Not started." },
    users: { state: "idle", message: "Not started." },
    fingerprints: { state: "idle", message: "Not started." },
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
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

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

function readNumberFromRecord(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
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

function readStringFromRecord(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function readBooleanFromRecord(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") {
      return value
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (normalized === "true") return true
      if (normalized === "false") return false
    }
  }
  return null
}

function prettifyLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed))
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "-"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "-"
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return formatDateTime(trimmed)
    }
    return trimmed
  }
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "-"
  if (typeof value === "object") return "Available"
  return "-"
}

function employeeDisplayName(employee: AdminRecord) {
  return (
    [
      readStringFromRecord(employee, ["first_name"]),
      readStringFromRecord(employee, ["middle_name"]),
      readStringFromRecord(employee, ["last_name"]),
    ]
      .filter(Boolean)
      .join(" ") ||
    readStringFromRecord(employee, ["full_name", "display_name", "name", "employee_name"]) ||
    "Unknown employee"
  )
}

function deviceUserLabel(record: AdminRecord) {
  return (
    readStringFromRecord(record, [
      "device_user_name",
      "deviceUserName",
      "matched_name",
      "matchedName",
      "employee_name",
      "name",
      "full_name",
      "display_name",
    ]) ?? "Unnamed device user"
  )
}

function normalizeDeviceUserMatchOptions(rows: AdminRecord[]) {
  const options = new Map<string, DeviceUserMatchOption>()

  for (const row of rows) {
    const employeeNo =
      readStringFromRecord(row, [
        "employee_no",
        "device_employee_no",
        "deviceEmployeeNo",
        "matched_employee_no",
        "matchedEmployeeNo",
        "user_no",
      ]) ?? ""

    if (!employeeNo) {
      continue
    }

    const score =
      readNumberFromRecord(row, ["match_score", "score", "confidence_score", "confidenceScore"]) ??
      null
    const label = deviceUserLabel(row)
    const detailParts = [
      score !== null ? `Match ${Math.round(score)}` : null,
      readStringFromRecord(row, ["reason", "match_reason", "matchReason"]),
    ].filter((part): part is string => Boolean(part))

    options.set(employeeNo, {
      employeeNo,
      label,
      detail: detailParts.length ? detailParts.join(" · ") : null,
    })
  }

  return Array.from(options.values()).sort((left, right) => left.label.localeCompare(right.label))
}

function formatDeviceEmployeesError(errorObject: unknown) {
  const message =
    errorObject instanceof Error && errorObject.message
      ? errorObject.message
      : "Failed to load device employees."

  const status =
    typeof errorObject === "object" &&
    errorObject !== null &&
    "status" in errorObject &&
    typeof (errorObject as { status?: unknown }).status === "number"
      ? (errorObject as { status: number }).status
      : null

  if (status === 500 && message.toLowerCase() === "internal server error") {
    return "Unable to load employees for this device right now. The server returned an internal error (500)."
  }

  return message
}

function buildInitialCredentialForm(userVerifyMode = "") {
  return {
    credential_type: "FINGERPRINT" as CredentialTypeValue,
    pin_password: "",
    user_verify_mode: userVerifyMode,
    fingerprint_id: "",
    sync_to_device: true,
  }
}

function getAllowedCredentialTypes(userVerifyMode: string) {
  const supportedTypes = USER_VERIFY_MODE_CREDENTIAL_MAP[userVerifyMode] ?? []
  return new Set<CredentialTypeValue>(supportedTypes)
}

function findFingerprintOptionById(id: string) {
  return FINGERPRINT_OPTIONS.find((option) => option.id === id) ?? null
}

function normalizeFingerprintSlots(rows: AdminRecord[]) {
  const slots = new Map<string, FingerprintSlotSummary>()

  for (const row of rows) {
    const status =
      readStringFromRecord(row, ["credential_status", "status", "sync_status", "fingerprint_status"]) ??
      "Saved"
    const normalizedStatus = status.trim().toLowerCase()
    if (normalizedStatus === "deleted" || normalizedStatus === "removed") {
      continue
    }

    const recordId =
      readStringFromRecord(row, ["fingerprint_id", "fingerprintId", "id"]) ??
      readStringFromRecord(row, ["uuid", "record_id", "recordId"])
    const fingerNo = readNumberFromRecord(row, ["finger_no", "fingerNo"])
    const slotKey = fingerNo !== null ? String(fingerNo) : recordId
    if (!slotKey) {
      continue
    }

    const option = fingerNo !== null ? findFingerprintOptionById(String(fingerNo)) : null
    slots.set(slotKey, {
      id: slotKey,
      recordId: recordId ?? slotKey,
      slotNo: fingerNo,
      label: option ? option.label : `Fingerprint Slot ${slotKey}`,
      enabled:
        !readBooleanFromRecord(row, ["disabled"]) &&
        (readBooleanFromRecord(row, ["is_enabled", "enabled", "is_active", "active"]) ?? true),
      status,
    })
  }

  return Array.from(slots.values()).sort((left, right) => {
    const leftOrder = left.slotNo ?? Number.POSITIVE_INFINITY
    const rightOrder = right.slotNo ?? Number.POSITIVE_INFINITY
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }
    return left.label.localeCompare(right.label)
  })
}

function HandFingerprintSelector({
  value,
  onChange,
  occupiedSlots = [],
}: {
  value: string
  onChange: (value: string) => void
  occupiedSlots?: FingerprintSlotSummary[]
}) {
  const selectedOption = FINGERPRINT_OPTIONS.find((option) => option.id === value) ?? null
  const occupiedSlotIds = new Set(
    occupiedSlots
      .map((slot) => (slot.slotNo !== null ? String(slot.slotNo) : slot.id))
      .filter((slotId) => slotId.length > 0)
  )
  const hints = React.useMemo<FingerSelectorHint[]>(() => {
    const nextHints: FingerSelectorHint[] = [
      {
        tone: "info",
        text: selectedOption
          ? `Ready to capture ${selectedOption.label} on slot ${selectedOption.id}.`
          : "Choose the exact finger you want the device to scan.",
      },
    ]

    if (occupiedSlots.length) {
      nextHints.push({
        tone: "warning",
        text: `Saved already: ${occupiedSlots.map((slot) => slot.label).join(", ")}.`,
      })
    }

    return nextHints
  }, [occupiedSlots, selectedOption])

  const renderHand = (hand: "left" | "right") => {
    const options = FINGERPRINT_OPTIONS.filter((option) => option.hand === hand)

    return (
      <div className="rounded-[1.75rem] border border-slate-200 bg-linear-to-br from-white via-slate-50 to-sky-50/60 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {hand === "left" ? "Left Hand" : "Right Hand"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {hand === "left" ? "Choose from thumb to little finger." : "Mirror view for the right hand."}
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {options.length} sensors
          </span>
        </div>
        <div className="relative mx-auto h-72 w-full max-w-[18rem] overflow-hidden rounded-[1.5rem] border border-white/70 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(241,245,249,0.86)_42%,rgba(226,232,240,0.74)_100%)]">
          <div className="absolute inset-x-6 bottom-5 top-14 rounded-[2.5rem] border border-slate-200/80 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" />
          <div className="absolute bottom-5 left-1/2 h-40 w-32 -translate-x-1/2 rounded-[2.5rem] border border-slate-200/90 bg-linear-to-b from-white to-slate-100/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]" />
          <div className="absolute bottom-4 left-1/2 h-16 w-12 -translate-x-1/2 rounded-b-[1.5rem] rounded-t-[0.65rem] border border-slate-200/90 bg-linear-to-b from-white to-slate-100/80" />
          {options.map((option) => {
            const isSelected = option.id === value
            const isOccupied = occupiedSlotIds.has(option.id)
            return (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "absolute flex h-16 w-12 flex-col items-center justify-center rounded-[999px] border text-[11px] font-semibold transition duration-200",
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white shadow-[0_16px_32px_rgba(15,23,42,0.22)]"
                    : isOccupied
                      ? "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400"
                      : "border-slate-300 bg-white/95 text-slate-700 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-900"
                )}
                style={{ top: option.top, left: option.left }}
                onClick={() => onChange(option.id)}
                title={
                  isOccupied
                    ? `${option.label} (${option.id}) is already saved`
                    : `${option.label} (${option.id})`
                }
              >
                <span className="text-center leading-tight">{option.shortLabel}</span>
                <span className={cn("text-[10px] font-medium", isSelected ? "text-white/80" : "text-slate-400")}>
                  {isOccupied ? "Saved" : `#${option.id}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 lg:grid-cols-2">
        {hints.map((hint) => (
          <div
            key={`${hint.tone}-${hint.text}`}
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm shadow-sm",
              hint.tone === "info"
                ? "border-sky-200 bg-sky-50/90 text-sky-800"
                : "border-amber-200 bg-amber-50/90 text-amber-900"
            )}
          >
            {hint.text}
          </div>
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {renderHand("left")}
        {renderHand("right")}
      </div>
      <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <span className="font-medium text-slate-900">Selected Finger:</span>{" "}
        {selectedOption ? `${selectedOption.label} (Slot ${selectedOption.id})` : "None selected yet"}
      </div>
    </div>
  )
}

function CredentialTypePicker({
  value,
  onChange,
  allowedTypes,
  requireVerifyMode,
}: {
  value: CredentialTypeValue
  onChange: (value: CredentialTypeValue) => void
  allowedTypes?: Set<CredentialTypeValue>
  requireVerifyMode?: boolean
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {CREDENTIAL_TYPE_CHOICES.map((choice) => {
        const Icon = choice.icon
        const isSelected = value === choice.value
        const supportedInUi = choice.enabled
        const enabledByVerifyMode = allowedTypes ? allowedTypes.has(choice.value) : !requireVerifyMode
        const isEnabled = supportedInUi && enabledByVerifyMode
        const disabledLabel = !supportedInUi
          ? "Unavailable"
          : requireVerifyMode && !allowedTypes
            ? "Choose Verify Mode"
            : "Not In This Mode"

        return (
          <button
            key={choice.value}
            type="button"
            disabled={!isEnabled}
            onClick={() => isEnabled && onChange(choice.value)}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              isSelected
                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                : isEnabled
                  ? "border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50"
                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{choice.label}</span>
                </div>
                <p
                  className={`mt-1 text-xs ${
                    isSelected
                      ? "text-slate-200"
                      : isEnabled
                        ? "text-slate-500"
                        : "text-slate-400"
                  }`}
                >
                  {choice.description}
                </p>
              </div>
              {!isEnabled ? (
                <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  {disabledLabel}
                </span>
              ) : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function AttendanceDeviceDetailView({ deviceId }: { deviceId: string }) {
  const [activeTab, setActiveTab] = React.useState<DeviceTabKey>("details")
  const [device, setDevice] = React.useState<AdminRecord | null>(null)
  const [assignedEmployees, setAssignedEmployees] = React.useState<AdminRecord[]>([])
  const [allEmployees, setAllEmployees] = React.useState<AdminRecord[]>([])
  const [accessGroups, setAccessGroups] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [employeesError, setEmployeesError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [employeeSearch, setEmployeeSearch] = React.useState("")

  const [assignEmployeeOpen, setAssignEmployeeOpen] = React.useState(false)
  const [assignEmployeePickerOpen, setAssignEmployeePickerOpen] = React.useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState("")
  const [selectedAccessGroupId, setSelectedAccessGroupId] = React.useState("")
  const [assignEmployeeSearch, setAssignEmployeeSearch] = React.useState("")
  const [assignEmployeeError, setAssignEmployeeError] = React.useState<string | null>(null)
  const [assignDeviceUserMatches, setAssignDeviceUserMatches] = React.useState<DeviceUserMatchOption[]>([])
  const [assignDeviceUserLoading, setAssignDeviceUserLoading] = React.useState(false)
  const [selectedDeviceUserEmployeeNo, setSelectedDeviceUserEmployeeNo] = React.useState("")
  const [assignedEmployeeForCredentialStep, setAssignedEmployeeForCredentialStep] =
    React.useState<AdminRecord | null>(null)
  const [assignedEmployeeDetailsSnapshot, setAssignedEmployeeDetailsSnapshot] = React.useState<{
    accessGroupId: string
    userVerifyMode: string
  } | null>(null)
  const [includeCredentialsOnAssign, setIncludeCredentialsOnAssign] = React.useState(false)
  const [credentialForm, setCredentialForm] = React.useState(buildInitialCredentialForm)
  const [assignFingerprintSlots, setAssignFingerprintSlots] = React.useState<FingerprintSlotSummary[]>([])
  const [assigningEmployee, setAssigningEmployee] = React.useState(false)
  const [editingAssignedEmployeeDetails, setEditingAssignedEmployeeDetails] = React.useState(false)
  const [savingAssignedEmployeeDetails, setSavingAssignedEmployeeDetails] = React.useState(false)
  const [credentialEmployee, setCredentialEmployee] = React.useState<AdminRecord | null>(null)
  const [manageCredentialsOpen, setManageCredentialsOpen] = React.useState(false)
  const [manageCredentialsError, setManageCredentialsError] = React.useState<string | null>(null)
  const [manageFingerprintSlots, setManageFingerprintSlots] = React.useState<FingerprintSlotSummary[]>([])
  const [manageFingerprintActionKey, setManageFingerprintActionKey] = React.useState("")
  const [savingCredentials, setSavingCredentials] = React.useState(false)
  const [fingerprintCaptureDialogState, setFingerprintCaptureDialogState] =
    React.useState<FingerprintCaptureDialogState | null>(null)
  const [credentialAlertState, setCredentialAlertState] = React.useState<CredentialAlertState | null>(null)
  const [employeePendingRemoval, setEmployeePendingRemoval] = React.useState<AdminRecord | null>(null)
  const [removeEmployeeOpen, setRemoveEmployeeOpen] = React.useState(false)
  const [removeEmployeeError, setRemoveEmployeeError] = React.useState<string | null>(null)
  const [removingEmployeeId, setRemovingEmployeeId] = React.useState("")

  const [syncingId, setSyncingId] = React.useState("")
  const [syncingResourceKey, setSyncingResourceKey] = React.useState("")
  const [readyForResourceSync, setReadyForResourceSync] = React.useState(false)
  const [deviceSyncStatus, setDeviceSyncStatus] = React.useState<DeviceSyncStatus>(
    buildInitialDeviceSyncStatus()
  )
  const [testingConnection, setTestingConnection] = React.useState(false)
  const [attendanceSyncSnapshot, setAttendanceSyncSnapshot] = React.useState<AdminRecord | null>(null)
  const [accessSyncSnapshot, setAccessSyncSnapshot] = React.useState<AdminRecord | null>(null)

  const fetchDeviceData = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setEmployeesError(null)

    try {
      const deviceRecord = await getAttendanceResourceById(token, "devices", deviceId)
      setDevice(deviceRecord)

      const [
        assignedEmployeesResult,
        employeesResult,
        accessGroupsResult,
        attendanceSyncResult,
        accessSyncResult,
      ] = await Promise.allSettled([
        listAttendanceDeviceEmployees(token, deviceId, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        listEmployees(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        listAccessControlResources(token, "groups", {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        }),
        getAttendanceDeviceSyncStatus(token, deviceId),
        getAccessControlAttendanceDeviceSyncStatus(token, deviceId),
      ])

      if (assignedEmployeesResult.status === "fulfilled") {
        setAssignedEmployees(
          assignedEmployeesResult.value.rows.map((employee) => ({
            ...employee,
            employee_name:
              readStringFromRecord(employee, [
                "employee_name",
                "name",
                "full_name",
                "display_name",
              ]) ?? employeeDisplayName(employee),
            resolved_employee_id:
              readNumberFromRecord(employee, [
                "employee_id",
                "employeeId",
                "id",
                "user_id",
                "userId",
              ]) ?? null,
            resolved_employee_no:
              readStringFromRecord(employee, [
                "employee_no",
                "employee_number",
                "employeeNumber",
                "user_no",
              ]) ?? "-",
          }))
        )
      } else {
        setAssignedEmployees([])
        setEmployeesError(formatDeviceEmployeesError(assignedEmployeesResult.reason))
      }

      if (employeesResult.status === "fulfilled") {
        setAllEmployees(employeesResult.value.rows)
      } else {
        setAllEmployees([])
        setEmployeesError((currentError) =>
          currentError ??
          formatDeviceEmployeesError(employeesResult.reason)
        )
      }

      if (accessGroupsResult.status === "fulfilled") {
        setAccessGroups(accessGroupsResult.value.rows)
      } else {
        setAccessGroups([])
      }

      setAttendanceSyncSnapshot(
        attendanceSyncResult.status === "fulfilled" ? asRecord(attendanceSyncResult.value) : null
      )
      setAccessSyncSnapshot(accessSyncResult.status === "fulfilled" ? asRecord(accessSyncResult.value) : null)
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Failed to load device details.")
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  React.useEffect(() => {
    void fetchDeviceData()
  }, [fetchDeviceData])

  const deviceName = React.useMemo(
    () =>
      readStringFromRecord(device ?? {}, ["device_name", "name", "device_model"]) ??
      `Device ${deviceId}`,
    [device, deviceId]
  )

  const assignedEmployeeIds = React.useMemo(
    () =>
      new Set(
        assignedEmployees
          .map((employee) =>
            readNumberFromRecord(employee, ["resolved_employee_id", "id", "employee_id", "employeeId"])
          )
          .filter((employeeId): employeeId is number => employeeId !== null)
      ),
    [assignedEmployees]
  )

  const assignableEmployees = React.useMemo(
    () =>
      allEmployees.filter((employee) => {
        const employeeId = readNumberFromRecord(employee, ["id", "employee_id", "employeeId"])
        return employeeId !== null && !assignedEmployeeIds.has(employeeId)
      }),
    [allEmployees, assignedEmployeeIds]
  )

  const filteredAssignableEmployees = React.useMemo(() => {
    const normalizedSearch = assignEmployeeSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return assignableEmployees
    }

    return assignableEmployees.filter((employee) => {
      const employeeNo =
        readStringFromRecord(employee, ["employee_no", "employee_number", "employeeNumber", "user_no"]) ??
        ""
      const name = employeeDisplayName(employee)
      return [employeeNo, name].some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [assignEmployeeSearch, assignableEmployees])

  const selectedAssignableEmployeeLabel = React.useMemo(() => {
    if (!selectedEmployeeId) {
      return "Select employee"
    }

    const selectedEmployee =
      assignableEmployees.find(
        (employee) =>
          readNumberFromRecord(employee, ["id", "employee_id", "employeeId"]) === Number(selectedEmployeeId)
      ) ?? null

    if (!selectedEmployee) {
      return "Select employee"
    }

    const employeeNo =
      readStringFromRecord(selectedEmployee, ["employee_no", "employee_number", "employeeNumber", "user_no"]) ??
      "-"

    return `${employeeDisplayName(selectedEmployee)} (${employeeNo})`
  }, [assignableEmployees, selectedEmployeeId])

  const getEmployeeRecordById = React.useCallback(
    (employeeId: string) => {
      const parsedEmployeeId = Number(employeeId)
      if (!Number.isFinite(parsedEmployeeId)) {
        return null
      }

      return (
        allEmployees.find(
          (employee) =>
            readNumberFromRecord(employee, ["id", "employee_id", "employeeId"]) === parsedEmployeeId
        ) ?? null
      )
    },
    [allEmployees]
  )

  const accessGroupOptions = React.useMemo(
    () =>
      accessGroups.map((group) => {
        const id = readNumberFromRecord(group, ["id", "group_id", "groupId"])
        const label =
          readStringFromRecord(group, ["group_name", "display_name", "name", "groupName"]) ??
          (id !== null ? `Group ${id}` : "Unnamed group")

        return id === null ? null : { id: String(id), label }
      }).filter((option): option is { id: string; label: string } => option !== null),
    [accessGroups]
  )

  const isPasswordCredential =
    credentialForm.credential_type === "PASSWORD" || credentialForm.credential_type === "PIN"
  const isFingerprintCredential = credentialForm.credential_type === "FINGERPRINT"
  const assignAllowedCredentialTypes = React.useMemo(
    () =>
      credentialForm.user_verify_mode ? getAllowedCredentialTypes(credentialForm.user_verify_mode) : undefined,
    [credentialForm.user_verify_mode]
  )
  const assignCredentialModeReady =
    !!assignAllowedCredentialTypes?.size &&
    assignAllowedCredentialTypes.has(credentialForm.credential_type)
  const assignedSummaryAccessGroupLabel = React.useMemo(
    () =>
      accessGroupOptions.find(
        (group) => group.id === (assignedEmployeeDetailsSnapshot?.accessGroupId ?? selectedAccessGroupId)
      )?.label ?? "-",
    [accessGroupOptions, assignedEmployeeDetailsSnapshot, selectedAccessGroupId]
  )
  const assignedSummaryVerifyModeLabel = React.useMemo(() => {
    const value = assignedEmployeeDetailsSnapshot?.userVerifyMode ?? credentialForm.user_verify_mode
    return (USER_VERIFY_MODE_OPTIONS.find((option) => option.value === value)?.label ?? value) || "-"
  }, [assignedEmployeeDetailsSnapshot, credentialForm.user_verify_mode])

  const loadFingerprintSlots = React.useCallback(
    async (token: string, employeeId: string | number) => {
      try {
        const rows = await listEmployeeDeviceFingerprints(token, employeeId, deviceId)
        return normalizeFingerprintSlots(rows)
      } catch (errorObject) {
        const status =
          typeof errorObject === "object" &&
          errorObject !== null &&
          "status" in errorObject &&
          typeof (errorObject as { status?: unknown }).status === "number"
            ? (errorObject as { status: number }).status
            : null

        // The list can be unavailable before the assignment exists yet.
        if (status === 404) {
          return []
        }

        throw errorObject
      }
    },
    [deviceId]
  )

  React.useEffect(() => {
    if (selectedAccessGroupId) {
      return
    }
    if (accessGroupOptions.length === 1) {
      setSelectedAccessGroupId(accessGroupOptions[0].id)
    }
  }, [accessGroupOptions, selectedAccessGroupId])

  React.useEffect(() => {
    if (!includeCredentialsOnAssign || !assignAllowedCredentialTypes?.size) {
      return
    }

    if (assignAllowedCredentialTypes.has(credentialForm.credential_type)) {
      return
    }

    const [nextCredentialType] = Array.from(assignAllowedCredentialTypes)
    if (!nextCredentialType) {
      return
    }

    setCredentialForm((current) => ({
      ...buildInitialCredentialForm(),
      credential_type: nextCredentialType,
      user_verify_mode: current.user_verify_mode,
    }))
  }, [
    assignAllowedCredentialTypes,
    credentialForm.credential_type,
    includeCredentialsOnAssign,
  ])

  React.useEffect(() => {
    if (
      !assignEmployeeOpen ||
      !assignedEmployeeForCredentialStep ||
      !includeCredentialsOnAssign ||
      !isFingerprintCredential ||
      !selectedEmployeeId
    ) {
      setAssignFingerprintSlots([])
      return
    }

    const token = readStoredToken()
    if (!token) {
      setAssignFingerprintSlots([])
      return
    }

    let cancelled = false
    void loadFingerprintSlots(token, selectedEmployeeId)
      .then((slots) => {
        if (!cancelled) {
          setAssignFingerprintSlots(slots)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignFingerprintSlots([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    assignedEmployeeForCredentialStep,
    assignEmployeeOpen,
    includeCredentialsOnAssign,
    isFingerprintCredential,
    loadFingerprintSlots,
    selectedEmployeeId,
  ])

  React.useEffect(() => {
    if (!assignEmployeeOpen || !!assignedEmployeeForCredentialStep || !selectedEmployeeId) {
      setAssignDeviceUserMatches([])
      setAssignDeviceUserLoading(false)
      setSelectedDeviceUserEmployeeNo("")
      return
    }

    const token = readStoredToken()
    if (!token) {
      setAssignDeviceUserMatches([])
      setAssignDeviceUserLoading(false)
      setSelectedDeviceUserEmployeeNo("")
      return
    }

    let cancelled = false
    setAssignDeviceUserLoading(true)

    void listAttendanceDeviceAssignmentMatches(token, deviceId, selectedEmployeeId)
      .then((rows) => {
        if (cancelled) {
          return
        }

        const options = normalizeDeviceUserMatchOptions(rows)
        setAssignDeviceUserMatches(options)
        setSelectedDeviceUserEmployeeNo((current) =>
          current && options.some((option) => option.employeeNo === current) ? current : ""
        )
      })
      .catch(() => {
        if (!cancelled) {
          setAssignDeviceUserMatches([])
          setSelectedDeviceUserEmployeeNo("")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAssignDeviceUserLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [assignEmployeeOpen, assignedEmployeeForCredentialStep, deviceId, selectedEmployeeId])

  const resetAssignEmployeeDialog = React.useCallback(() => {
    setAssignEmployeeError(null)
    setAssignEmployeePickerOpen(false)
    setSelectedEmployeeId("")
    setSelectedAccessGroupId(accessGroupOptions.length === 1 ? accessGroupOptions[0].id : "")
    setAssignEmployeeSearch("")
    setAssignDeviceUserMatches([])
    setAssignDeviceUserLoading(false)
    setSelectedDeviceUserEmployeeNo("")
    setAssignedEmployeeForCredentialStep(null)
    setAssignedEmployeeDetailsSnapshot(null)
    setIncludeCredentialsOnAssign(false)
    setAssignFingerprintSlots([])
    setEditingAssignedEmployeeDetails(false)
    setSavingAssignedEmployeeDetails(false)
    setCredentialForm(buildInitialCredentialForm())
  }, [accessGroupOptions])

  const filteredAssignedEmployees = React.useMemo(() => {
    const normalizedSearch = employeeSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return assignedEmployees
    }

    return assignedEmployees.filter((employee) =>
      [
        readStringFromRecord(employee, ["resolved_employee_no", "employee_no", "employee_number", "user_no"]),
        readStringFromRecord(employee, ["employee_name"]),
        readStringFromRecord(employee, ["status"]),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch))
    )
  }, [assignedEmployees, employeeSearch])

  const setSyncStepStatus = React.useCallback(
    (step: DeviceSyncStepKey, state: DeviceSyncStepState, nextMessage?: string) => {
      setDeviceSyncStatus((prev) => ({
        ...prev,
        [step]: { state, ...(nextMessage ? { message: nextMessage } : {}) },
      }))
    },
    []
  )

  const runSyncStep = React.useCallback(
    async (
      step: DeviceSyncStepKey,
      action: () => Promise<unknown>,
      options: { pendingMessage: string; successMessage: string; timeoutMs?: number }
    ) => {
      setSyncStepStatus(step, "running", options.pendingMessage)
      try {
        await withTimeout(action(), options.timeoutMs ?? 20000, `${options.pendingMessage} timed out.`)
        setSyncStepStatus(step, "success", options.successMessage)
      } catch (errorObject) {
        const nextMessage =
          errorObject instanceof Error ? errorObject.message : `${options.pendingMessage} failed.`
        setSyncStepStatus(step, "error", nextMessage)
        throw errorObject
      }
    },
    [setSyncStepStatus]
  )

  const onSyncDevice = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    setSyncingId(deviceId)
    try {
      await runSyncStep("core", async () => await syncAttendanceDevice(token, deviceId), {
        pendingMessage: "Syncing device",
        successMessage: "Device synced",
      })
      setReadyForResourceSync(true)
      setMessage("Device synced successfully.")
      setError(null)
      await fetchDeviceData()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Sync failed.")
    } finally {
      setSyncingId("")
    }
  }

  const onTestConnection = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    setTestingConnection(true)
    try {
      await testAttendanceDeviceConnection(token, deviceId)
      setMessage("Device connection test completed.")
      setError(null)
      await fetchDeviceData()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Connection test failed.")
    } finally {
      setTestingConnection(false)
    }
  }

  const onSyncDeviceResource = async (resource: Exclude<DeviceSyncStepKey, "core">) => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    if (!readyForResourceSync) {
      setError("Sync the device first before syncing linked resources.")
      return
    }

    setSyncingResourceKey(resource)
    try {
      const action =
        resource === "doors"
          ? async () => await syncAccessControlDeviceDoors(token, deviceId)
          : resource === "templates"
            ? async () => await syncAccessControlDeviceTemplates(token, deviceId)
            : resource === "week-plans"
              ? async () => await syncAccessControlDeviceWeekPlans(token, deviceId)
              : resource === "users"
                ? async () => await syncHikvisionDeviceUsers(token, deviceId)
                : async () => await syncHikvisionDeviceFingerprints(token, deviceId)

      const label =
        resource === "week-plans"
          ? "Week plans"
          : resource === "users"
            ? "Users"
            : resource === "fingerprints"
              ? "Fingerprints"
          : resource.charAt(0).toUpperCase() + resource.slice(1)

      await runSyncStep(resource, action, {
        pendingMessage: `Syncing ${label.toLowerCase()}`,
        successMessage: `${label} synced`,
        timeoutMs: resource === "users" || resource === "fingerprints" ? 90000 : 20000,
      })

      setMessage(`${label} synced successfully.`)
      setError(null)
      await fetchDeviceData()
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Sync failed.")
    } finally {
      setSyncingResourceKey("")
    }
  }

  const buildFingerprintCaptureSelection = React.useCallback(
    (
      options?: { fingerprintSlots?: FingerprintSlotSummary[] }
    ) => {
      const selectedFingerprintId = credentialForm.fingerprint_id.trim()
      if (!selectedFingerprintId) {
        throw new Error("Select the finger to capture before saving credentials.")
      }

      const existingSlot = options?.fingerprintSlots?.find((slot) => slot.id === selectedFingerprintId)
      if (existingSlot) {
        throw new Error(`${existingSlot.label} is already saved for this employee. Choose another finger.`)
      }

      const fingerNo = Number.parseInt(selectedFingerprintId, 10)
      if (!Number.isFinite(fingerNo) || fingerNo <= 0) {
        throw new Error("Select a valid finger position before capturing.")
      }

      return {
        fingerNo,
        fingerprintLabel: findFingerprintOptionById(selectedFingerprintId)?.label ?? `Fingerprint Slot ${fingerNo}`,
      }
    },
    [credentialForm.fingerprint_id]
  )

  const saveCredentialsForEmployee = React.useCallback(
    async (
      token: string,
      employeeId: number,
      options?: { fingerprintSlots?: FingerprintSlotSummary[] }
    ) => {
      const userVerifyMode = credentialForm.user_verify_mode.trim()

      if (isPasswordCredential) {
        const pinPassword = credentialForm.pin_password.trim()
        if (!pinPassword) {
          throw new Error(
            credentialForm.credential_type === "PIN"
              ? "Enter a PIN before saving credentials."
              : "Enter a password before saving credentials."
          )
        }

        try {
          await createEmployeeDevicePassword(token, employeeId, deviceId, {
            password: pinPassword,
            ...(userVerifyMode ? { user_verify_mode: userVerifyMode } : {}),
          })
        } catch (passwordError) {
          const status =
            typeof passwordError === "object" &&
            passwordError !== null &&
            "status" in passwordError &&
            typeof (passwordError as { status?: unknown }).status === "number"
              ? (passwordError as { status: number }).status
              : null

          if (status === 404 || status === 409) {
            await updateEmployeeDevicePassword(token, employeeId, deviceId, {
              password: pinPassword,
              ...(userVerifyMode ? { user_verify_mode: userVerifyMode } : {}),
            })
          } else {
            throw passwordError
          }
        }

        return
      }

      if (isFingerprintCredential) {
        const { fingerNo } = buildFingerprintCaptureSelection(options)

        await captureEmployeeDeviceFingerprint(token, employeeId, deviceId, {
          finger_no: fingerNo,
          sync_to_device: credentialForm.sync_to_device,
        })

        const refreshedSlots = await loadFingerprintSlots(token, employeeId)
        const capturedSlot =
          refreshedSlots.find((slot) => slot.slotNo === fingerNo || slot.id === String(fingerNo)) ?? null

        if (!capturedSlot) {
          throw new Error(
            "Fingerprint capture completed, but the saved fingerprint record could not be confirmed. Refresh and try again."
          )
        }

        if (credentialForm.sync_to_device) {
          const normalizedStatus = capturedSlot.status.trim().toLowerCase()
          if (normalizedStatus && /(failed|error|denied|unauthorized)/.test(normalizedStatus)) {
            throw new Error(`Fingerprint was captured, but device sync failed: ${capturedSlot.status}.`)
          }
        }

        return
      }

      throw new Error("Select a supported credential type to continue.")
    },
    [
      buildFingerprintCaptureSelection,
      credentialForm,
      deviceId,
      isFingerprintCredential,
      isPasswordCredential,
      loadFingerprintSlots,
    ]
  )

  const showCredentialAlert = React.useCallback((title: string, message: string) => {
    setCredentialAlertState({ title, message })
  }, [])

  const onAssignEmployee = async () => {
    const token = readStoredToken()
    if (!token) {
      setAssignEmployeeError("Authentication required. Please log in again.")
      return
    }
    if (!selectedEmployeeId) {
      setAssignEmployeeError("Select an employee to assign.")
      return
    }
    if (!selectedAccessGroupId) {
      setAssignEmployeeError("Select an access group for this employee.")
      return
    }
    if (!credentialForm.user_verify_mode.trim()) {
      setAssignEmployeeError("Select a verify mode before assigning this employee to the device.")
      return
    }

    setAssigningEmployee(true)
    setAssignEmployeeError(null)
    try {
      await assignEmployeeDevices(token, selectedEmployeeId, {
        access_group_id: selectedAccessGroupId,
        device_ids: [deviceId],
        user_verify_mode: credentialForm.user_verify_mode.trim(),
      })

      try {
        await registerEmployeeDeviceUser(token, selectedEmployeeId, deviceId, {
          ...(selectedDeviceUserEmployeeNo ? { employee_no: selectedDeviceUserEmployeeNo } : {}),
          access_group_id: Number(selectedAccessGroupId),
          user_verify_mode: credentialForm.user_verify_mode.trim(),
          sync_now: true,
        })
      } catch (registerError) {
        const status =
          typeof registerError === "object" &&
          registerError !== null &&
          "status" in registerError &&
          typeof (registerError as { status?: unknown }).status === "number"
            ? (registerError as { status: number }).status
            : null

        if (status === 404 || status === 409) {
          await resyncEmployeeDeviceUser(token, selectedEmployeeId, deviceId)
        } else {
          throw registerError
        }
      }
      setAssignedEmployeeForCredentialStep(getEmployeeRecordById(selectedEmployeeId))
      setAssignedEmployeeDetailsSnapshot({
        accessGroupId: selectedAccessGroupId,
        userVerifyMode: credentialForm.user_verify_mode.trim(),
      })
      setMessage("Employee assigned to device successfully.")
      setError(null)
      await fetchDeviceData()
    } catch (errorObject) {
      setAssignEmployeeError(
        errorObject instanceof Error ? errorObject.message : "Failed to assign employee."
      )
    } finally {
      setAssigningEmployee(false)
    }
  }

  const onSaveAssignedEmployeeCredentials = async () => {
    const token = readStoredToken()
    if (!token) {
      setAssignEmployeeError("Authentication required. Please log in again.")
      return
    }
    if (!assignedEmployeeForCredentialStep) {
      setAssignEmployeeError("Assign an employee to the device first.")
      return
    }

    const employeeId = readNumberFromRecord(assignedEmployeeForCredentialStep, [
      "resolved_employee_id",
      "id",
      "employee_id",
      "employeeId",
    ])
    if (employeeId === null) {
      setAssignEmployeeError("This employee does not have a valid id.")
      return
    }

    if (!includeCredentialsOnAssign) {
      setAssignEmployeeOpen(false)
      resetAssignEmployeeDialog()
      return
    }

    const employeeName = employeeDisplayName(assignedEmployeeForCredentialStep)
    let captureDialogState: FingerprintCaptureDialogState | null = null

    if (includeCredentialsOnAssign && isFingerprintCredential) {
      try {
        const { fingerprintLabel } = buildFingerprintCaptureSelection({
          fingerprintSlots: assignFingerprintSlots,
        })
        captureDialogState = {
          employeeName,
          fingerprintLabel,
        }
      } catch (errorObject) {
        const message =
          errorObject instanceof Error ? errorObject.message : "Select the finger to capture before saving credentials."
        setAssignEmployeeError(message)
        showCredentialAlert("Fingerprint capture unavailable", message)
        return
      }
    }

    setSavingCredentials(true)
    setAssignEmployeeError(null)
    try {
      if (captureDialogState) {
        setFingerprintCaptureDialogState(captureDialogState)
      }

      await saveCredentialsForEmployee(token, employeeId, {
        fingerprintSlots: assignFingerprintSlots,
      })

      setMessage("Employee assigned to device and credentials saved successfully.")
      setError(null)
      setAssignEmployeeOpen(false)
      resetAssignEmployeeDialog()
      await fetchDeviceData()
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Failed to save device credentials."
      setAssignEmployeeError(message)
      showCredentialAlert("Fingerprint capture failed", message)
    } finally {
      setSavingCredentials(false)
      setFingerprintCaptureDialogState(null)
    }
  }

  const onUpdateAssignedEmployeeDetails = async () => {
    const token = readStoredToken()
    if (!token) {
      setAssignEmployeeError("Authentication required. Please log in again.")
      return
    }
    if (!assignedEmployeeForCredentialStep) {
      setAssignEmployeeError("Assign an employee to the device first.")
      return
    }

    const employeeId = readNumberFromRecord(assignedEmployeeForCredentialStep, [
      "resolved_employee_id",
      "id",
      "employee_id",
      "employeeId",
    ])
    if (employeeId === null) {
      setAssignEmployeeError("This employee does not have a valid id.")
      return
    }
    if (!selectedAccessGroupId) {
      setAssignEmployeeError("Select an access group for this employee.")
      return
    }
    if (!credentialForm.user_verify_mode.trim()) {
      setAssignEmployeeError("Select a verify mode before saving these assignment details.")
      return
    }

    setSavingAssignedEmployeeDetails(true)
    setAssignEmployeeError(null)
    try {
      await updateEmployeeDeviceUser(token, employeeId, deviceId, {
        access_group_id: Number(selectedAccessGroupId),
        user_verify_mode: credentialForm.user_verify_mode.trim(),
      })
      setAssignedEmployeeDetailsSnapshot({
        accessGroupId: selectedAccessGroupId,
        userVerifyMode: credentialForm.user_verify_mode.trim(),
      })
      setEditingAssignedEmployeeDetails(false)
      setMessage("Assignment details updated successfully.")
      setError(null)
      await fetchDeviceData()
    } catch (errorObject) {
      setAssignEmployeeError(
        errorObject instanceof Error ? errorObject.message : "Failed to update assignment details."
      )
    } finally {
      setSavingAssignedEmployeeDetails(false)
    }
  }

  const requestManageCredentials = (employee: AdminRecord) => {
    setCredentialEmployee(employee)
    setManageCredentialsError(null)
    setCredentialForm(
      buildInitialCredentialForm(
        readStringFromRecord(employee, ["user_verify_mode", "userVerifyMode"]) ?? ""
      )
    )
    setManageCredentialsOpen(true)
  }

  const manageAllowedCredentialTypes = React.useMemo(
    () =>
      credentialForm.user_verify_mode ? getAllowedCredentialTypes(credentialForm.user_verify_mode) : undefined,
    [credentialForm.user_verify_mode]
  )
  const manageCredentialModeReady =
    !manageAllowedCredentialTypes?.size ||
    manageAllowedCredentialTypes.has(credentialForm.credential_type)

  React.useEffect(() => {
    if (!manageCredentialsOpen || !credentialEmployee) {
      setManageFingerprintSlots([])
      return
    }

    const token = readStoredToken()
    if (!token) {
      setManageFingerprintSlots([])
      return
    }

    const employeeId = readNumberFromRecord(credentialEmployee, [
      "resolved_employee_id",
      "id",
      "employee_id",
      "employeeId",
    ])
    if (employeeId === null) {
      setManageFingerprintSlots([])
      return
    }

    let cancelled = false
    void loadFingerprintSlots(token, employeeId)
      .then((slots) => {
        if (!cancelled) {
          setManageFingerprintSlots(slots)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setManageFingerprintSlots([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [credentialEmployee, loadFingerprintSlots, manageCredentialsOpen])

  React.useEffect(() => {
    if (!manageCredentialsOpen || !manageAllowedCredentialTypes?.size) {
      return
    }

    if (manageAllowedCredentialTypes.has(credentialForm.credential_type)) {
      return
    }

    const [nextCredentialType] = Array.from(manageAllowedCredentialTypes)
    if (!nextCredentialType) {
      return
    }

    setCredentialForm((current) => ({
      ...buildInitialCredentialForm(),
      credential_type: nextCredentialType,
      user_verify_mode: current.user_verify_mode,
    }))
  }, [credentialForm.credential_type, manageAllowedCredentialTypes, manageCredentialsOpen])

  const onSaveCredentials = async () => {
    const token = readStoredToken()
    if (!token) {
      setManageCredentialsError("Authentication required. Please log in again.")
      return
    }
    if (!credentialEmployee) {
      setManageCredentialsError("Select an assigned employee first.")
      return
    }

    const employeeId = readNumberFromRecord(credentialEmployee, [
      "resolved_employee_id",
      "id",
      "employee_id",
      "employeeId",
    ])
    if (employeeId === null) {
      setManageCredentialsError("This employee does not have a valid id.")
      return
    }

    const employeeName = employeeDisplayName(credentialEmployee)
    let captureDialogState: FingerprintCaptureDialogState | null = null

    if (isFingerprintCredential) {
      try {
        const { fingerprintLabel } = buildFingerprintCaptureSelection({
          fingerprintSlots: manageFingerprintSlots,
        })
        captureDialogState = {
          employeeName,
          fingerprintLabel,
        }
      } catch (errorObject) {
        const message =
          errorObject instanceof Error ? errorObject.message : "Select the finger to capture before saving credentials."
        setManageCredentialsError(message)
        showCredentialAlert("Fingerprint capture unavailable", message)
        return
      }
    }

    setSavingCredentials(true)
    setManageCredentialsError(null)
    try {
      if (captureDialogState) {
        setFingerprintCaptureDialogState(captureDialogState)
      }

      await saveCredentialsForEmployee(token, employeeId, {
        fingerprintSlots: manageFingerprintSlots,
      })

      setMessage("Device credentials updated successfully.")
      setError(null)
      setManageCredentialsOpen(false)
      setCredentialEmployee(null)
      setCredentialForm(buildInitialCredentialForm())
      await fetchDeviceData()
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Failed to update device credentials."
      setManageCredentialsError(message)
      showCredentialAlert("Fingerprint capture failed", message)
    } finally {
      setSavingCredentials(false)
      setFingerprintCaptureDialogState(null)
    }
  }

  const onManageFingerprintAction = async (
    action: "sync" | "resync" | "disable" | "enable" | "delete",
    fingerprintId: string
  ) => {
    const token = readStoredToken()
    if (!token) {
      setManageCredentialsError("Authentication required. Please log in again.")
      return
    }
    if (!credentialEmployee) {
      setManageCredentialsError("Select an assigned employee first.")
      return
    }

    const employeeId = readNumberFromRecord(credentialEmployee, [
      "resolved_employee_id",
      "id",
      "employee_id",
      "employeeId",
    ])
    if (employeeId === null) {
      setManageCredentialsError("This employee does not have a valid id.")
      return
    }

    const fingerprintKey = `${action}:${fingerprintId}`
    const currentSlot =
      manageFingerprintSlots.find(
        (slot) => slot.id === fingerprintId || slot.recordId === fingerprintId || String(slot.slotNo) === fingerprintId
      ) ?? null
    const backendFingerprintId = currentSlot?.recordId ?? fingerprintId
    setManageFingerprintActionKey(fingerprintKey)
    setManageCredentialsError(null)

    try {
      if (action === "disable") {
        await disableEmployeeDeviceFingerprint(token, employeeId, deviceId, backendFingerprintId)
      } else if (action === "enable") {
        await enableEmployeeDeviceFingerprint(token, employeeId, deviceId, backendFingerprintId)
      } else if (action === "delete") {
        await deleteEmployeeDeviceFingerprint(token, employeeId, deviceId, backendFingerprintId, {})
      } else {
        const payload = credentialForm.user_verify_mode.trim()
          ? { user_verify_mode: credentialForm.user_verify_mode.trim() }
          : {}

        if (action === "sync") {
          await syncEmployeeDeviceFingerprint(token, employeeId, deviceId, backendFingerprintId, payload)
        } else {
          await resyncEmployeeDeviceFingerprint(token, employeeId, deviceId, backendFingerprintId, payload)
        }
      }

      const slots = await loadFingerprintSlots(token, employeeId)
      setManageFingerprintSlots(slots)
      const slot =
        slots.find(
          (item) =>
            item.recordId === backendFingerprintId ||
            item.id === fingerprintId ||
            (currentSlot?.slotNo !== null && item.slotNo === currentSlot?.slotNo)
        ) ?? null
      const slotLabel = slot?.label ?? currentSlot?.label ?? "Fingerprint"
      setMessage(
        action === "delete"
          ? `${slotLabel} removed successfully.`
          : `${slotLabel} ${action === "disable" ? "disabled" : action === "enable" ? "enabled" : `${action}ed`} successfully.`
      )
      setError(null)
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : action === "delete"
            ? "Failed to remove fingerprint."
            : "Failed to update fingerprint."
      setManageCredentialsError(message)
      showCredentialAlert(action === "delete" ? "Fingerprint removal failed" : "Fingerprint update failed", message)
    } finally {
      setManageFingerprintActionKey("")
    }
  }

  const requestRemoveEmployee = (employee: AdminRecord) => {
    setEmployeePendingRemoval(employee)
    setRemoveEmployeeError(null)
    setRemoveEmployeeOpen(true)
  }

  const onRemoveEmployee = async () => {
    const token = readStoredToken()
    if (!token) {
      setRemoveEmployeeError("Authentication required. Please log in again.")
      return
    }
    if (!employeePendingRemoval) {
      setRemoveEmployeeError("Select an employee to remove.")
      return
    }

    const employeeId = readNumberFromRecord(employeePendingRemoval, [
      "resolved_employee_id",
      "id",
      "employee_id",
      "employeeId",
    ])
    if (employeeId === null) {
      setRemoveEmployeeError("This employee does not have a valid id.")
      return
    }

    setRemovingEmployeeId(String(employeeId))
    setRemoveEmployeeError(null)
    try {
      await removeEmployeeDeviceAssignment(token, employeeId, deviceId)
      setMessage("Employee removed from device.")
      setError(null)
      setRemoveEmployeeOpen(false)
      setEmployeePendingRemoval(null)
      await fetchDeviceData()
    } catch (errorObject) {
      setRemoveEmployeeError(
        errorObject instanceof Error ? errorObject.message : "Failed to remove employee."
      )
    } finally {
      setRemovingEmployeeId("")
    }
  }

  const deviceSummaryRows = [
    ["Device Name", deviceName],
    ["Device Code", readStringFromRecord(device ?? {}, ["device_code"])],
    ["Serial Number", readStringFromRecord(device ?? {}, ["device_serial_number"])],
    ["Device Model", readStringFromRecord(device ?? {}, ["device_model"])],
    ["Vendor", readStringFromRecord(device ?? {}, ["vendor_name"])],
    ["Integration Type", readStringFromRecord(device ?? {}, ["integration_type"])],
    ["Status", readStringFromRecord(device ?? {}, ["status"])],
    ["IP Address", readStringFromRecord(device ?? {}, ["ip_address"])],
    ["Branch", stringifyValue(device?.branch_id)],
    ["Timezone", readStringFromRecord(device ?? {}, ["timezone"])],
    ["Assigned Employees", String(assignedEmployees.length)],
    ["Last Synced", stringifyValue(device?.last_synced_at)],
  ]
  const attendanceSyncRows = [
    ["Attendance Sync Status", stringifyValue(attendanceSyncSnapshot?.status ?? attendanceSyncSnapshot?.sync_status)],
    ["Attendance Heartbeat", stringifyValue(attendanceSyncSnapshot?.last_heartbeat_at ?? attendanceSyncSnapshot?.heartbeat_at)],
    ["Attendance Last Error", stringifyValue(attendanceSyncSnapshot?.last_error ?? attendanceSyncSnapshot?.error_message)],
  ]
  const accessSyncRows = [
    ["Access Sync Status", stringifyValue(accessSyncSnapshot?.status ?? accessSyncSnapshot?.sync_status)],
    ["Access Last Sync", stringifyValue(accessSyncSnapshot?.last_synced_at ?? accessSyncSnapshot?.updated_at)],
    ["Access Last Error", stringifyValue(accessSyncSnapshot?.last_error ?? accessSyncSnapshot?.error_message)],
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2">
              <Link
                href="/dashboard/attendance/devices"
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to devices
              </Link>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{deviceName}</h2>
            <p className="text-sm text-slate-500">
              Device details, sync controls, and assigned employees.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onTestConnection()}
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={testingConnection}
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </button>
            <button
              type="button"
              onClick={() => void fetchDeviceData()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-primary hover:bg-slate-50"
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCwIcon className={`h-4 w-4 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {[
            ["details", "Device Details"],
            ["employees", "Employees"],
            ["sync", "Sync"],
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              className={`rounded-full px-4 py-2 text-sm transition ${
                activeTab === tabKey
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab(tabKey as DeviceTabKey)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "details" ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {deviceSummaryRows.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                  <p className="mt-1 text-sm text-slate-900">{value || "-"}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-medium uppercase text-slate-500">Attendance Device Health</p>
                <div className="mt-3 space-y-2">
                  {attendanceSyncRows.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-right text-slate-900">{value || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-medium uppercase text-slate-500">Access Control Health</p>
                <div className="mt-3 space-y-2">
                  {accessSyncRows.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-right text-slate-900">{value || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "employees" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Assigned Employees</h3>
                <p className="text-sm text-slate-500">
                  Employees currently linked to this device.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => setAssignEmployeeOpen(true)}
              >
                <PlusIcon className="h-4 w-4" />
                Assign Employee
              </button>
            </div>

            {employeesError ? <p className="text-sm text-red-600">{employeesError}</p> : null}

            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                placeholder="Search employees by number, name, or status"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
              />
            </div>

            <TableScrollContainer>
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50/90">
                  <tr>
                    {["employee_no", "employee_name", "status", "created_at"].map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap"
                      >
                        {prettifyLabel(column)}
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/80">
                  {!loading && filteredAssignedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-sm text-slate-500">
                        {employeeSearch.trim()
                          ? "No assigned employees matched your search."
                          : "No employees assigned to this device yet."}
                      </td>
                    </tr>
                  ) : null}
                  {filteredAssignedEmployees.map((employee, index) => {
                    const employeeId =
                      readNumberFromRecord(employee, ["resolved_employee_id", "id", "employee_id"]) ??
                      `employee-${index}`
                    const employeeRowKey = [
                      String(employeeId),
                      readStringFromRecord(employee, [
                        "resolved_employee_no",
                        "employee_no",
                        "employee_number",
                        "user_no",
                      ]) ?? "no-number",
                      readStringFromRecord(employee, ["assigned_at", "created_at", "updated_at"]) ?? `row-${index}`,
                      String(index),
                    ].join(":")

                    return (
                      <tr key={employeeRowKey}>
                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {stringifyValue(
                            employee.resolved_employee_no ??
                              employee.employee_no ??
                              employee.employee_number ??
                              employee.user_no
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {stringifyValue(employee.employee_name)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {stringifyValue(employee.status)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {stringifyValue(
                            employee.assigned_at ?? employee.created_at ?? employee.updated_at
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-sky-300 text-sky-700 hover:bg-sky-50"
                              onClick={() => requestManageCredentials(employee)}
                              aria-label="Manage credentials"
                              title="Manage credentials"
                            >
                              <FingerprintIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                              onClick={() => requestRemoveEmployee(employee)}
                              aria-label="Remove employee"
                              title="Remove employee"
                            >
                              <Trash2Icon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScrollContainer>
          </div>
        ) : null}

        {activeTab === "sync" ? (
          <div className="grid gap-3">
            {(["core", "doors", "templates", "week-plans", "users", "fingerprints"] as DeviceSyncStepKey[]).map((step) => {
              const status =
                deviceSyncStatus[step] ?? {
                  state: "idle" as DeviceSyncStepState,
                  message: "Not started.",
                }
              const label =
                step === "core"
                  ? "Device"
                  : step === "week-plans"
                    ? "Week Plans"
                    : step === "users"
                      ? "Users"
                      : step === "fingerprints"
                        ? "Fingerprints"
                    : step.charAt(0).toUpperCase() + step.slice(1)
              const tone =
                status.state === "success"
                  ? "text-green-700"
                  : status.state === "error"
                    ? "text-red-600"
                    : status.state === "running"
                      ? "text-amber-600"
                      : "text-slate-500"

              return (
                <div
                  key={step}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className={`text-xs ${tone}`}>
                      {status.message ?? (status.state === "idle" ? "Not started." : status.state)}
                    </p>
                  </div>
                  {step === "core" ? (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
                      disabled={syncingId.length > 0}
                      onClick={() => void onSyncDevice()}
                    >
                      {syncingId.length > 0 ? "Syncing..." : "Sync Device"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
                      disabled={!readyForResourceSync || syncingResourceKey === step || syncingId.length > 0}
                      onClick={() => void onSyncDeviceResource(step)}
                    >
                      Sync {label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <Dialog
        open={assignEmployeeOpen}
        onOpenChange={(open) => {
          setAssignEmployeeOpen(open)
          if (!open) {
            resetAssignEmployeeDialog()
          }
        }}
      >
      <DialogPopup className="max-h-[85vh] w-[min(92vw,42rem)] overflow-y-auto sm:max-w-[42rem]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Assign Employee To Device</DialogTitle>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-700"
                  aria-label="Assignment help"
                  role="img"
                >
                  <CircleHelpIcon className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" align="start" className="max-w-72 text-left leading-relaxed">
                Select an employee, access group, and verify mode first. Credentials can be added
                after the assignment succeeds.
              </TooltipContent>
            </Tooltip>
          </div>
          <DialogDescription className="sr-only">
            Select an employee, access group, and verify mode first. Credentials can be added after the assignment succeeds.
          </DialogDescription>
        </DialogHeader>
          <div className="grid gap-3">
            {assignEmployeeError ? <p className="text-sm text-red-600">{assignEmployeeError}</p> : null}
            {!assignedEmployeeForCredentialStep ? (
              <>
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase text-slate-600">Employee</span>
                  <div className="relative">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                      onClick={() => setAssignEmployeePickerOpen((current) => !current)}
                      aria-expanded={assignEmployeePickerOpen}
                    >
                      <span className={selectedEmployeeId ? "text-slate-900" : "text-slate-500"}>
                        {selectedAssignableEmployeeLabel}
                      </span>
                      <span className="text-slate-500">{assignEmployeePickerOpen ? "▲" : "▼"}</span>
                    </button>
                    {assignEmployeePickerOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                        <div className="relative">
                          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                            placeholder="Search employees by number or name"
                            value={assignEmployeeSearch}
                            onChange={(event) => setAssignEmployeeSearch(event.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200">
                          {filteredAssignableEmployees.length ? (
                            filteredAssignableEmployees.map((employee, index) => {
                              const employeeId = readNumberFromRecord(employee, [
                                "id",
                                "employee_id",
                                "employeeId",
                              ])
                              if (employeeId === null) return null
                              const employeeNo =
                                readStringFromRecord(employee, [
                                  "employee_no",
                                  "employee_number",
                                  "employeeNumber",
                                  "user_no",
                                ]) ?? "-"

                              return (
                                <button
                                  key={`assign-employee-${employeeId}-${index}`}
                                  type="button"
                                  className={`flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 ${
                                    selectedEmployeeId === String(employeeId) ? "bg-slate-100" : ""
                                  }`}
                                  onClick={() => {
                                    setSelectedEmployeeId(String(employeeId))
                                    setAssignEmployeePickerOpen(false)
                                  }}
                                >
                                  <span className="text-slate-900">{employeeDisplayName(employee)}</span>
                                  <span className="shrink-0 text-xs text-slate-500">{employeeNo}</span>
                                </button>
                              )
                            })
                          ) : (
                            <div className="px-3 py-3">
                              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                                {assignableEmployees.length === 0
                                  ? "No unassigned employees are currently available for this device."
                                  : "No available employees matched your search."}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <label className="grid gap-1">
                  <span className="text-xs font-medium uppercase text-slate-600">Access Group</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                    value={selectedAccessGroupId}
                    onChange={(event) => setSelectedAccessGroupId(event.target.value)}
                  >
                    <option value="">Select access group</option>
                    {accessGroupOptions.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium uppercase text-slate-600">Device User</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                    value={selectedDeviceUserEmployeeNo}
                    onChange={(event) => setSelectedDeviceUserEmployeeNo(event.target.value)}
                    disabled={!selectedEmployeeId || assignDeviceUserLoading}
                  >
                    <option value="">
                      {selectedEmployeeId
                        ? assignDeviceUserLoading
                          ? "Searching device users..."
                          : "Register as a new device user"
                        : "Select employee first"}
                    </option>
                    {assignDeviceUserMatches.map((match) => (
                      <option key={match.employeeNo} value={match.employeeNo}>
                        {match.label} ({match.employeeNo})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">
                    {selectedDeviceUserEmployeeNo
                      ? assignDeviceUserMatches.find((match) => match.employeeNo === selectedDeviceUserEmployeeNo)
                          ?.detail ?? "Existing device user will be linked during registration."
                      : assignDeviceUserMatches.length
                        ? "Choose a matched user if this employee already exists on the device."
                        : selectedEmployeeId
                          ? "No matching unassigned device users were found. A new device user will be registered."
                          : "Pick the employee first to search for users already stored on the device."}
                  </span>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium uppercase text-slate-600">User Verify Mode</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                    value={credentialForm.user_verify_mode}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        user_verify_mode: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select verify mode</option>
                    {USER_VERIFY_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
                  Employee assigned successfully. You can add credentials now or close this dialog and manage them later from the employee row.
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {employeeDisplayName(assignedEmployeeForCredentialStep)}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Employee No:{" "}
                        {readStringFromRecord(assignedEmployeeForCredentialStep, [
                          "employee_no",
                          "employee_number",
                          "employeeNumber",
                          "user_no",
                        ]) ?? "-"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => {
                        if (editingAssignedEmployeeDetails && assignedEmployeeDetailsSnapshot) {
                          setSelectedAccessGroupId(assignedEmployeeDetailsSnapshot.accessGroupId)
                          setCredentialForm((current) => ({
                            ...current,
                            user_verify_mode: assignedEmployeeDetailsSnapshot.userVerifyMode,
                          }))
                        }
                        setEditingAssignedEmployeeDetails((current) => !current)
                      }}
                      disabled={savingAssignedEmployeeDetails}
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      {editingAssignedEmployeeDetails ? "Close edit" : "Edit"}
                    </button>
                  </div>
                  {editingAssignedEmployeeDetails ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-xs font-medium uppercase text-slate-600">Access Group</span>
                        <select
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                          value={selectedAccessGroupId}
                          onChange={(event) => setSelectedAccessGroupId(event.target.value)}
                        >
                          <option value="">Select access group</option>
                          {accessGroupOptions.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-medium uppercase text-slate-600">User Verify Mode</span>
                        <select
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                          value={credentialForm.user_verify_mode}
                          onChange={(event) =>
                            setCredentialForm((current) => ({
                              ...current,
                              user_verify_mode: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select verify mode</option>
                          {USER_VERIFY_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                          onClick={() => void onUpdateAssignedEmployeeDetails()}
                          disabled={savingAssignedEmployeeDetails}
                        >
                          {savingAssignedEmployeeDetails ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-slate-500">
                        Access Group: {assignedSummaryAccessGroupLabel}
                      </p>
                      <p className="text-slate-500">Verify Mode: {assignedSummaryVerifyModeLabel}</p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeCredentialsOnAssign}
                  onClick={() => setIncludeCredentialsOnAssign((current) => !current)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm text-slate-700"
                >
                  <span>Add credentials now after the employee is assigned to this device</span>
                  <span
                    className={`relative h-6 w-11 rounded-full transition ${
                      includeCredentialsOnAssign ? "bg-slate-900" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        includeCredentialsOnAssign ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
                {includeCredentialsOnAssign ? (
                  <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Access Credentials</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Choose the credential tiles that match the verify mode saved on this assignment.
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs font-medium uppercase text-slate-600">Credential Type</span>
                      <CredentialTypePicker
                        value={credentialForm.credential_type}
                        onChange={(nextType) =>
                          setCredentialForm((current) => ({
                            ...buildInitialCredentialForm(),
                            credential_type: nextType,
                            user_verify_mode: current.user_verify_mode,
                          }))
                        }
                        allowedTypes={assignAllowedCredentialTypes}
                        requireVerifyMode
                      />
                    </div>
                    {!credentialForm.user_verify_mode ? (
                      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                        Choose the verify mode first. Matching credential options will unlock below.
                      </div>
                    ) : null}
                    {assignCredentialModeReady && isPasswordCredential ? (
                      <label className="grid gap-1">
                        <span className="text-xs font-medium uppercase text-slate-600">
                          {credentialForm.credential_type === "PIN" ? "PIN Password" : "Password"}
                        </span>
                        <input
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                          value={credentialForm.pin_password}
                          onChange={(event) =>
                            setCredentialForm((current) => ({
                              ...current,
                              pin_password: event.target.value,
                            }))
                          }
                          placeholder={
                            credentialForm.credential_type === "PIN"
                              ? "Enter PIN password"
                              : "Enter password"
                          }
                        />
                      </label>
                    ) : null}
                    {assignCredentialModeReady && isFingerprintCredential ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase text-slate-600">
                            Capture Guidance
                          </span>
                          <Tooltip>
                            <TooltipTrigger>
                              <span
                                className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700"
                                aria-label="Fingerprint capture help"
                                role="img"
                              >
                                <CircleHelpIcon className="h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start" className="max-w-72 text-left leading-relaxed">
                              The employee is already assigned. Saving here captures the selected
                              finger from the device and can sync it immediately when enabled
                              below.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div>
                          <span className="mb-1 block text-xs font-medium uppercase text-slate-600">
                            Fingerprint Position
                          </span>
                          <HandFingerprintSelector
                            value={credentialForm.fingerprint_id}
                            onChange={(nextFingerprintId) =>
                              setCredentialForm((current) => ({
                                ...current,
                                fingerprint_id: nextFingerprintId,
                              }))
                            }
                            occupiedSlots={assignFingerprintSlots}
                          />
                        </div>
                        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={credentialForm.sync_to_device}
                            onChange={(event) =>
                              setCredentialForm((current) => ({
                                ...current,
                                sync_to_device: event.target.checked,
                              }))
                            }
                          />
                          Sync captured fingerprint to device immediately
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-auto"
              onClick={() => {
                setAssignEmployeeOpen(false)
                resetAssignEmployeeDialog()
              }}
            >
              {assignedEmployeeForCredentialStep ? "Close" : "Cancel"}
            </button>
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 sm:w-auto"
              onClick={() =>
                void (assignedEmployeeForCredentialStep
                  ? onSaveAssignedEmployeeCredentials()
                  : onAssignEmployee())
              }
              disabled={
                assignedEmployeeForCredentialStep
                  ? savingCredentials
                  : assigningEmployee || !selectedEmployeeId || !selectedAccessGroupId
              }
            >
              {assignedEmployeeForCredentialStep ? (
                savingCredentials ? (
                  "Saving..."
                ) : includeCredentialsOnAssign && isFingerprintCredential ? (
                  "Save & Capture Fingerprint"
                ) : includeCredentialsOnAssign ? (
                  "Save Credentials"
                ) : (
                  "Done"
                )
              ) : assigningEmployee ? (
                <span className="inline-flex items-center gap-2">
                  Assigning...
                </span>
              ) : (
                "Assign To Device"
              )}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={manageCredentialsOpen}
        onOpenChange={(open) => {
          setManageCredentialsOpen(open)
          if (!open) {
            setManageCredentialsError(null)
            setCredentialEmployee(null)
            setCredentialForm(buildInitialCredentialForm())
          }
        }}
      >
        <DialogPopup className="max-h-[85vh] w-[min(92vw,42rem)] overflow-y-auto sm:max-w-[42rem]">
          <DialogHeader>
            <DialogTitle>Manage Device Credentials</DialogTitle>
            <DialogDescription>
              Add or update credentials for this employee after the device assignment is already in place.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {manageCredentialsError ? <p className="text-sm text-red-600">{manageCredentialsError}</p> : null}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                {readStringFromRecord(credentialEmployee ?? {}, ["employee_name"]) ?? "Selected employee"}
              </p>
              <p className="mt-1 text-slate-500">
                Employee No:{" "}
                {readStringFromRecord(credentialEmployee ?? {}, [
                  "resolved_employee_no",
                  "employee_no",
                  "employee_number",
                  "user_no",
                ]) ?? "-"}
              </p>
              <p className="text-slate-500">Device: {deviceName}</p>
              <p className="text-slate-500">
                Verify Mode:{" "}
                {(USER_VERIFY_MODE_OPTIONS.find((option) => option.value === credentialForm.user_verify_mode)?.label ??
                  credentialForm.user_verify_mode) || "-"}
              </p>
            </div>
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Access Credentials</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Add or update credentials for the verify mode already saved on this device assignment.
                  </p>
                </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="grid gap-1 lg:col-span-2">
                  <span className="text-xs font-medium uppercase text-slate-600">Credential Type</span>
                  <CredentialTypePicker
                    value={credentialForm.credential_type}
                    onChange={(nextType) =>
                      setCredentialForm((current) => ({
                        ...buildInitialCredentialForm(),
                        credential_type: nextType,
                        user_verify_mode: current.user_verify_mode,
                      }))
                    }
                    allowedTypes={manageAllowedCredentialTypes}
                    requireVerifyMode={Boolean(manageAllowedCredentialTypes?.size)}
                  />
                </div>

                {manageCredentialModeReady && isPasswordCredential ? (
                  <label className="grid gap-1 lg:col-span-2">
                    <span className="text-xs font-medium uppercase text-slate-600">
                      {credentialForm.credential_type === "PIN" ? "PIN Password" : "Password"}
                    </span>
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                      value={credentialForm.pin_password}
                      onChange={(event) =>
                        setCredentialForm((current) => ({
                          ...current,
                          pin_password: event.target.value,
                        }))
                      }
                      placeholder={
                        credentialForm.credential_type === "PIN"
                          ? "Enter PIN password"
                          : "Enter password"
                      }
                    />
                  </label>
                ) : null}

                {manageCredentialModeReady && isFingerprintCredential ? (
                  <>
                    <div className="flex items-center gap-2 lg:col-span-2">
                      <span className="text-xs font-medium uppercase text-slate-600">
                        Capture Guidance
                      </span>
                      <Tooltip>
                        <TooltipTrigger>
                          <span
                            className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700"
                            aria-label="Fingerprint capture help"
                            role="img"
                          >
                            <CircleHelpIcon className="h-4 w-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="max-w-72 text-left leading-relaxed">
                          Capture happens after the employee is already assigned to this device.
                          Saving here uses the new capture flow and can sync to the device
                          immediately when selected.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="lg:col-span-2">
                      <span className="mb-1 block text-xs font-medium uppercase text-slate-600">
                        Fingerprint Position
                      </span>
                      <HandFingerprintSelector
                        value={credentialForm.fingerprint_id}
                        onChange={(nextFingerprintId) =>
                          setCredentialForm((current) => ({
                            ...current,
                            fingerprint_id: nextFingerprintId,
                          }))
                        }
                        occupiedSlots={manageFingerprintSlots}
                      />
                    </div>
                    {manageFingerprintSlots.length ? (
                      <div className="grid gap-2 lg:col-span-2">
                        <span className="text-xs font-medium uppercase text-slate-600">
                          Saved Fingerprints
                        </span>
                        <div className="grid gap-2">
                          {manageFingerprintSlots.map((slot) => {
                            const isRunning = manageFingerprintActionKey.endsWith(`:${slot.id}`)
                            return (
                              <div
                                key={`saved-fingerprint-${slot.id}`}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{slot.label}</p>
                                  <p className="text-xs text-slate-500">
                                    Slot {slot.id} · {slot.status} · {slot.enabled ? "Enabled" : "Disabled"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                                    onClick={() => void onManageFingerprintAction("sync", slot.id)}
                                    disabled={!!manageFingerprintActionKey}
                                  >
                                    {isRunning && manageFingerprintActionKey.startsWith("sync:") ? "Syncing..." : "Sync"}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                                    onClick={() => void onManageFingerprintAction("resync", slot.id)}
                                    disabled={!!manageFingerprintActionKey}
                                  >
                                    {isRunning && manageFingerprintActionKey.startsWith("resync:")
                                      ? "Resyncing..."
                                      : "Resync"}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                                    onClick={() =>
                                      void onManageFingerprintAction(slot.enabled ? "disable" : "enable", slot.id)
                                    }
                                    disabled={!!manageFingerprintActionKey}
                                  >
                                    {isRunning &&
                                    (manageFingerprintActionKey.startsWith("disable:") ||
                                      manageFingerprintActionKey.startsWith("enable:"))
                                      ? slot.enabled
                                        ? "Disabling..."
                                        : "Enabling..."
                                      : slot.enabled
                                        ? "Disable"
                                        : "Enable"}
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                                    onClick={() => void onManageFingerprintAction("delete", slot.id)}
                                    disabled={!!manageFingerprintActionKey}
                                  >
                                    <Trash2Icon className="h-3.5 w-3.5" />
                                    {isRunning && manageFingerprintActionKey.startsWith("delete:")
                                      ? "Removing..."
                                      : "Remove"}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={credentialForm.sync_to_device}
                        onChange={(event) =>
                          setCredentialForm((current) => ({
                            ...current,
                            sync_to_device: event.target.checked,
                            }))
                          }
                        />
                      Sync captured fingerprint to device immediately
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-auto"
              onClick={() => {
                setManageCredentialsOpen(false)
                setManageCredentialsError(null)
                setCredentialEmployee(null)
                setCredentialForm(buildInitialCredentialForm())
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 sm:w-auto"
              onClick={() => void onSaveCredentials()}
              disabled={savingCredentials || !credentialEmployee}
            >
              {savingCredentials
                ? "Saving..."
                : isFingerprintCredential
                  ? "Save & Capture Fingerprint"
                  : "Save Credentials"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={!!fingerprintCaptureDialogState}
        onOpenChange={(open) => {
          if (!open) {
            setFingerprintCaptureDialogState(null)
          }
        }}
      >
        <DialogPopup className="w-[min(92vw,24rem)] rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-2xl sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Waiting for fingerprint capture</DialogTitle>
            <DialogDescription>
              Keep the selected finger on the device sensor until the capture completes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 text-center text-slate-900">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight">Waiting for fingerprint input</h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-slate-500">
                Ask {fingerprintCaptureDialogState?.employeeName ?? "the employee"} to place their{" "}
                {fingerprintCaptureDialogState?.fingerprintLabel?.toLowerCase() ?? "selected finger"} on the device
                sensor.
              </p>
            </div>

            <div className="relative flex min-h-52 w-full items-center justify-center">
              <span className="absolute size-28 rounded-full border border-cyan-200 animate-ping [animation-duration:2.2s]" />
              <span className="absolute size-40 rounded-full border border-cyan-100 animate-pulse" />
              <span className="absolute inset-x-14 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent animate-pulse" />
              <FingerprintIcon className="relative z-10 h-28 w-28 text-cyan-500 animate-pulse" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <span className="size-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0ms]" />
                <span className="size-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:150ms]" />
                <span className="size-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:300ms]" />
              </div>
              <p className="text-sm font-medium text-slate-600">Listening for a scan from the device sensor</p>
            </div>
          </div>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={!!credentialAlertState}
        onOpenChange={(open) => {
          if (!open) {
            setCredentialAlertState(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{credentialAlertState?.title ?? "Action failed"}</AlertDialogTitle>
            <AlertDialogDescription>
              {credentialAlertState?.message ?? "Something went wrong. Please try again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              type="button"
              className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
              onClick={() => setCredentialAlertState(null)}
            >
              OK
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={removeEmployeeOpen}
        onOpenChange={(open) => {
          setRemoveEmployeeOpen(open)
          if (!open) {
            setRemoveEmployeeError(null)
            setEmployeePendingRemoval(null)
          }
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Assigned Employee</DialogTitle>
            <DialogDescription>
              Confirm that you want to remove this employee from the device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {removeEmployeeError ? <p className="text-sm text-red-600">{removeEmployeeError}</p> : null}
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                {readStringFromRecord(employeePendingRemoval ?? {}, ["employee_name"]) ?? "Selected employee"}
              </p>
              <p className="mt-1 text-slate-500">
                Employee No:{" "}
                {readStringFromRecord(employeePendingRemoval ?? {}, [
                  "resolved_employee_no",
                  "employee_no",
                  "employee_number",
                  "user_no",
                ]) ?? "-"}
              </p>
              <p className="text-slate-500">Device: {deviceName}</p>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => {
                setRemoveEmployeeOpen(false)
                setRemoveEmployeeError(null)
                setEmployeePendingRemoval(null)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              onClick={() => void onRemoveEmployee()}
              disabled={
                !employeePendingRemoval ||
                removingEmployeeId ===
                  String(
                    readNumberFromRecord(employeePendingRemoval ?? {}, [
                      "resolved_employee_id",
                      "id",
                      "employee_id",
                    ]) ?? ""
                  )
              }
            >
              {removingEmployeeId &&
              removingEmployeeId ===
                String(
                  readNumberFromRecord(employeePendingRemoval ?? {}, [
                    "resolved_employee_id",
                    "id",
                    "employee_id",
                  ]) ?? ""
                )
                ? "Removing..."
                : "Remove Employee"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
