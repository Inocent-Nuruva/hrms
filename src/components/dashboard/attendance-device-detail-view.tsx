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
  createEmployeeDeviceCard,
  createEmployeeDevicePassword,
  deleteEmployeeDeviceFingerprint,
  disableEmployeeDeviceFingerprint,
  enableEmployeeDeviceFingerprint,
  getAccessControlAttendanceDeviceSyncStatus,
  getAttendanceDeviceSyncStatus,
  getAttendanceResourceById,
  getHikvisionSyncJob,
  listAccessControlResources,
  listAttendanceDeviceAssignmentMatches,
  listAttendanceDeviceEmployees,
  listEmployeeDeviceFingerprints,
  listAccessDeviceAuditLogs,
  listAccessDeviceScopedCommandLogs,
  listAccessEmployeeAuditLogs,
  listHikvisionDeviceAttendanceLogs,
  listEmployees,
  manageHikvisionDevice,
  registerEmployeeDeviceUser,
  resyncEmployeeDeviceFingerprint,
  resyncEmployeeDeviceUser,
  syncAccessControlDeviceDoors,
  syncAccessControlDeviceTemplates,
  syncAccessControlDeviceWeekPlans,
  syncHikvisionAttendanceByDate,
  syncHikvisionDeviceFingerprints,
  syncHikvisionDeviceUsers,
  syncEmployeeDeviceFingerprint,
  syncAttendanceDevice,
  testAttendanceDeviceConnection,
  updateEmployeeDeviceUser,
  updateEmployeeDevicePassword,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  EmployeeAccessRemovalDialog,
  type EmployeeAccessRemovalTarget,
} from "@/components/dashboard/employee-access-removal-dialog"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import { cn } from "@/lib/utils"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { env } from "@/lib/env"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type DeviceTabKey = "details" | "employees" | "sync" | "logs"

function readJobId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null
  const record = payload as Record<string, unknown>
  const nested =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : {}
  const value = record.jobId ?? record.job_id ?? nested.jobId ?? nested.job_id
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}
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
}

type FingerprintSlotSummary = {
  id: string
  label: string
  recordId: string
  slotNo: number | null
  enabled: boolean
  status: string
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
  { id: "1", label: "Left Thumb", shortLabel: "Thumb", hand: "left" },
  { id: "2", label: "Left Index", shortLabel: "Index", hand: "left" },
  { id: "3", label: "Left Middle", shortLabel: "Middle", hand: "left" },
  { id: "4", label: "Left Ring", shortLabel: "Ring", hand: "left" },
  { id: "5", label: "Left Little", shortLabel: "Little", hand: "left" },
  { id: "6", label: "Right Thumb", shortLabel: "Thumb", hand: "right" },
  { id: "7", label: "Right Index", shortLabel: "Index", hand: "right" },
  { id: "8", label: "Right Middle", shortLabel: "Middle", hand: "right" },
  { id: "9", label: "Right Ring", shortLabel: "Ring", hand: "right" },
  { id: "10", label: "Right Little", shortLabel: "Little", hand: "right" },
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

const SUPPORTED_CREDENTIAL_TYPES = new Set<CredentialTypeValue>(
  CREDENTIAL_TYPE_CHOICES.filter((choice) => choice.enabled).map((choice) => choice.value)
)

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
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }
  return null
}

/** Display helper for device summary cards — strings, numbers, nested labels. */
function readDisplayField(row: AdminRecord | null | undefined, keys: string[], nestedNameKeys: string[] = ["name", "title", "label"]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No"
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as AdminRecord
      for (const nestedKey of nestedNameKeys) {
        const nestedValue = nested[nestedKey]
        if (typeof nestedValue === "string" && nestedValue.trim()) {
          return nestedValue.trim()
        }
      }
    }
  }
  return null
}

function formatStatusLabel(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw || raw === "-" || raw === "—" || raw.toLowerCase() === "null") {
    return "—"
  }
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function isEmptyDisplay(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  return !raw || raw === "-" || raw === "—" || raw.toLowerCase() === "unknown" || raw.toLowerCase() === "null"
}

function statusTextClass(status: string) {
  const value = status.trim().toLowerCase()
  if (["active", "online", "connected", "success", "synced", "healthy", "enabled"].includes(value)) {
    return "text-emerald-600"
  }
  if (["inactive", "offline", "disconnected", "error", "failed", "disabled"].includes(value)) {
    return "text-rose-600"
  }
  if (["pending", "syncing", "warning", "degraded"].includes(value)) {
    return "text-amber-600"
  }
  if (["onboarding", "processing"].includes(value)) {
    return "text-sky-600"
  }
  return "text-slate-600"
}

function statusDotClass(status: string) {
  const value = status.trim().toLowerCase()
  if (["active", "online", "connected", "success", "synced", "healthy", "enabled"].includes(value)) {
    return "bg-emerald-500"
  }
  if (["inactive", "offline", "disconnected", "error", "failed", "disabled"].includes(value)) {
    return "bg-rose-500"
  }
  if (["pending", "syncing", "warning", "degraded"].includes(value)) {
    return "bg-amber-500"
  }
  if (["onboarding", "processing"].includes(value)) {
    return "bg-sky-500"
  }
  return "bg-slate-400"
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
  return new Set<CredentialTypeValue>(
    supportedTypes.filter((type): type is CredentialTypeValue => SUPPORTED_CREDENTIAL_TYPES.has(type))
  )
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

  const renderHand = (hand: "left" | "right") => {
    const options = FINGERPRINT_OPTIONS.filter((option) => option.hand === hand)
    // Visual order: little → ring → middle → index across top, thumb lower
    const ordered =
      hand === "left"
        ? [options[4], options[3], options[2], options[1], options[0]] // little..thumb
        : [options[0], options[1], options[2], options[3], options[4]] // thumb..little

    return (
      <div className="rounded-2xl border border-[color:rgb(var(--primary-rgb)/0.14)] bg-[color:rgb(var(--primary-rgb)/0.05)] p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">
            {hand === "left" ? "Left hand" : "Right hand"}
          </p>
          <span className="text-[11px] text-slate-500">
            {options.filter((o) => occupiedSlotIds.has(o.id)).length} enrolled
          </span>
        </div>

        {/* Soft finger row — friendly pills, not a medical hand diagram */}
        <div className="flex items-end justify-center gap-1.5 sm:gap-2">
          {ordered.map((option, index) => {
            if (!option) return null
            const isSelected = option.id === value
            const isOccupied = occupiedSlotIds.has(option.id)
            const isThumb = option.shortLabel === "Thumb"
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                title={option.label}
                className={cn(
                  "flex flex-col items-center justify-end rounded-2xl border px-1.5 pb-2 pt-3 transition-all sm:px-2",
                  isThumb ? "min-h-[5.25rem] w-[3.1rem] sm:w-[3.4rem]" : "min-h-[6.5rem] w-[2.85rem] sm:w-[3.15rem]",
                  // slight fan: taller middle fingers
                  !isThumb && index === 2 ? "min-h-[7rem]" : null,
                  !isThumb && (index === 1 || index === 3) ? "min-h-[6.75rem]" : null,
                  isSelected
                    ? "border-primary bg-primary !text-white shadow-md shadow-[0_8px_18px_rgb(var(--primary-rgb)/0.22)]"
                    : isOccupied
                      ? "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300"
                      : "border-white bg-white text-slate-700 shadow-sm hover:border-[color:rgb(var(--primary-rgb)/0.28)] hover:bg-[color:rgb(var(--primary-rgb)/0.06)]"
                )}
              >
                <FingerprintIcon
                  className={cn(
                    "mb-1.5 h-4 w-4",
                    isSelected ? "text-white/90" : isOccupied ? "text-amber-500" : "text-primary"
                  )}
                />
                <span className="text-[11px] font-semibold leading-tight">{option.shortLabel}</span>
                <span
                  className={cn(
                    "mt-0.5 text-[10px]",
                    isSelected ? "text-white/80" : "text-slate-400"
                  )}
                >
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <p className="text-sm text-slate-700">
          {selectedOption ? (
            <>
              <span className="font-medium text-slate-900">Selected finger:</span>{" "}
              {selectedOption.label}
            </>
          ) : (
            <span className="text-slate-600">Choose which finger to scan on the device.</span>
          )}
        </p>
        {selectedOption ? (
          <span className="text-[11px] font-medium text-primary">
            Slot {selectedOption.id}
          </span>
        ) : null}
      </div>

      {occupiedSlots.length > 0 ? (
        <p className="text-xs text-amber-800">
          Already on device: {occupiedSlots.map((slot) => slot.label).join(", ")}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {renderHand("left")}
        {renderHand("right")}
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
  const visibleChoices = React.useMemo(
    () => CREDENTIAL_TYPE_CHOICES.filter((choice) => choice.enabled),
    []
  )

  if (requireVerifyMode && allowedTypes && allowedTypes.size === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
        The selected verify mode does not expose any credential types this screen can manage yet.
        Use a verify mode that allows fingerprint, password, or PIN.
      </div>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visibleChoices.map((choice) => {
        const Icon = choice.icon
        const isSelected = value === choice.value
        const enabledByVerifyMode = allowedTypes ? allowedTypes.has(choice.value) : !requireVerifyMode
        const isEnabled = enabledByVerifyMode
        const disabledLabel =
          requireVerifyMode && !allowedTypes ? "Set verify mode first" : "Not in this mode"

        return (
          <button
            key={choice.value}
            type="button"
            disabled={!isEnabled}
            onClick={() => isEnabled && onChange(choice.value)}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition",
              isSelected
                ? "border-primary bg-[color:rgb(var(--primary-rgb)/0.08)] ring-1 ring-[color:rgb(var(--primary-rgb)/0.22)]"
                : isEnabled
                  ? "border-slate-200 bg-white hover:border-[color:rgb(var(--primary-rgb)/0.28)] hover:bg-slate-50"
                  : "cursor-not-allowed border-slate-100 bg-slate-50/80 opacity-60"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isSelected
                  ? "bg-primary !text-white"
                  : isEnabled
                    ? "bg-slate-100 text-slate-600"
                    : "bg-slate-100 text-slate-400"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className={cn("text-sm font-semibold", isSelected ? "text-primary" : "text-slate-900")}>
                  {choice.label}
                </span>
                {!isEnabled ? (
                  <span className="text-[10px] font-medium text-slate-500">
                    {disabledLabel}
                  </span>
                ) : isSelected ? (
                  <span className="text-[10px] font-medium text-primary">
                    Selected
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">{choice.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function AttendanceDeviceDetailView({ deviceId }: { deviceId: string }) {
  const actor = useDashboardActor()
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
  const [removalTarget, setRemovalTarget] = React.useState<EmployeeAccessRemovalTarget | null>(null)
  const [removalOpen, setRemovalOpen] = React.useState(false)

  const [syncingId, setSyncingId] = React.useState("")
  const [syncingResourceKey, setSyncingResourceKey] = React.useState("")
  const [readyForResourceSync, setReadyForResourceSync] = React.useState(false)
  const [deviceSyncStatus, setDeviceSyncStatus] = React.useState<DeviceSyncStatus>(
    buildInitialDeviceSyncStatus()
  )
  const canOpenAccessControlDevices =
    actor.ready &&
    canSeeDashboardPage(
      "/dashboard/access-control/devices",
      actor.permissionLabels,
      actor.accessMode
    )
  const [testingConnection, setTestingConnection] = React.useState(false)
  const [managingDevice, setManagingDevice] = React.useState(false)
  const [deviceAuditLogs, setDeviceAuditLogs] = React.useState<AdminRecord[]>([])
  const [deviceCommandLogs, setDeviceCommandLogs] = React.useState<AdminRecord[]>([])
  const [deviceLogsLoading, setDeviceLogsLoading] = React.useState(false)
  const [employeeLogsOpen, setEmployeeLogsOpen] = React.useState(false)
  const [employeeLogs, setEmployeeLogs] = React.useState<AdminRecord[]>([])
  const [employeeLogsLabel, setEmployeeLogsLabel] = React.useState("")
  const [employeeLogsLoading, setEmployeeLogsLoading] = React.useState(false)
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
      readDisplayField(device, [
        "device_name",
        "deviceName",
        "name",
        "title",
        "device_code",
        "deviceCode",
        "device_model",
        "deviceModel",
      ]) ?? `Device ${deviceId}`,
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
    (assignAllowedCredentialTypes?.has(credentialForm.credential_type) ?? false) &&
    Boolean(assignAllowedCredentialTypes?.size)
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
        readStringFromRecord(employee, [
          "resolved_employee_no",
          "employee_no",
          "employee_number",
          "user_no",
        ]),
        readStringFromRecord(employee, ["employee_name"]),
        employeeDisplayName(employee),
        readStringFromRecord(employee, ["status", "employment_status", "assignment_status"]),
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
        await withTimeout(action(), options.timeoutMs ?? env.NEXT_PUBLIC_DEVICE_ACTION_TIMEOUT_MS, `${options.pendingMessage} timed out.`)
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
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    setTestingConnection(true)
    try {
      await testAttendanceDeviceConnection(token, deviceId)
      setMessage(null)
      setError(null)
      showSuccessAlert("Device connection test completed.")
      await fetchDeviceData()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Connection test failed."
      setError(message)
      showErrorAlert(message)
    } finally {
      setTestingConnection(false)
    }
  }

  const onManageHikvisionDevice = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }
    setManagingDevice(true)
    try {
      const payload = await manageHikvisionDevice(token, deviceId)
      const jobId = readJobId(payload)
      if (jobId) {
        const job = await getHikvisionSyncJob(token, jobId)
        const status =
          readDisplayField(job, ["status", "state", "jobStatus"]) || "queued"
        showSuccessAlert(`Hikvision manage job ${jobId} is ${status}.`)
      } else {
        showSuccessAlert("Hikvision manage command sent.")
      }
      setError(null)
      await fetchDeviceData()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Manage command failed."
      setError(message)
      showErrorAlert(message)
    } finally {
      setManagingDevice(false)
    }
  }

  const loadDeviceLogs = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) return
    setDeviceLogsLoading(true)
    try {
      const [audit, commands] = await Promise.all([
        listAccessDeviceAuditLogs(token, deviceId, { page: 1, limit: 20 }),
        listAccessDeviceScopedCommandLogs(token, deviceId, { page: 1, limit: 20 }),
      ])
      setDeviceAuditLogs(audit.rows)
      setDeviceCommandLogs(commands.rows)
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Could not load device logs.")
    } finally {
      setDeviceLogsLoading(false)
    }
  }, [deviceId])

  React.useEffect(() => {
    if (activeTab !== "logs") return
    void loadDeviceLogs()
  }, [activeTab, loadDeviceLogs])

  const openEmployeeAuditLogs = async (employee: AdminRecord) => {
    const token = readStoredToken()
    const employeeId = readNumberFromRecord(employee, ["id", "employee_id", "employeeId"])
    if (!token || employeeId === null) return
    setEmployeeLogsLabel(
      readDisplayField(employee, ["full_name", "fullName", "employee_name", "employeeName", "name"]) ||
        `Employee ${employeeId}`
    )
    setEmployeeLogsOpen(true)
    setEmployeeLogsLoading(true)
    try {
      const result = await listAccessEmployeeAuditLogs(token, employeeId, { page: 1, limit: 20 })
      setEmployeeLogs(result.rows)
    } catch (errorObject) {
      setEmployeeLogs([])
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Could not load employee logs.")
    } finally {
      setEmployeeLogsLoading(false)
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
        timeoutMs:
          resource === "users" || resource === "fingerprints"
            ? env.NEXT_PUBLIC_DEVICE_BULK_ACTION_TIMEOUT_MS
            : env.NEXT_PUBLIC_DEVICE_ACTION_TIMEOUT_MS,
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
      if (!userVerifyMode) {
        throw new Error("Select or confirm the verify mode before saving credentials.")
      }

      const allowedCredentialTypes = getAllowedCredentialTypes(userVerifyMode)
      if (!allowedCredentialTypes.size) {
        throw new Error(
          "The selected verify mode does not support a credential flow in this screen yet. Use a mode that allows fingerprint, password, or PIN."
        )
      }
      if (!allowedCredentialTypes.has(credentialForm.credential_type)) {
        throw new Error("Select a credential type allowed by the saved verify mode.")
      }

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
    (manageAllowedCredentialTypes?.has(credentialForm.credential_type) ?? false) &&
    Boolean(manageAllowedCredentialTypes?.size)

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
    const employeeId = readNumberFromRecord(employee, [
      "resolved_employee_id",
      "id",
      "employee_id",
      "employeeId",
    ])
    if (employeeId === null) {
      showErrorAlert("This employee does not have a valid id.")
      return
    }
    setRemovalTarget({
      employeeId,
      employeeName: employeeDisplayName(employee),
      employeeNo:
        readStringFromRecord(employee, [
          "resolved_employee_no",
          "employee_no",
          "employee_number",
          "user_no",
        ]) ?? null,
      preferredDeviceId: deviceId,
      preferredDeviceLabel: deviceName,
    })
    setRemovalOpen(true)
  }

  const deviceSummaryRows: Array<{ label: string; value: string; emphasize?: boolean }> = [
    {
      label: "Device Name",
      value: deviceName,
      emphasize: true,
    },
    {
      label: "Device Code",
      value:
        readDisplayField(device, ["device_code", "deviceCode", "code", "device_no", "deviceNo"]) ?? "—",
    },
    {
      label: "Serial Number",
      value:
        readDisplayField(device, [
          "device_serial_number",
          "deviceSerialNumber",
          "serial_number",
          "serialNumber",
          "serial_no",
          "serialNo",
        ]) ?? "—",
    },
    {
      label: "Device Model",
      value:
        readDisplayField(device, ["device_model", "deviceModel", "model", "model_name", "modelName"]) ??
        "—",
    },
    {
      label: "Vendor",
      value:
        readDisplayField(device, ["vendor_name", "vendorName", "vendor", "manufacturer"]) ?? "—",
    },
    {
      label: "Integration Type",
      value:
        readDisplayField(device, [
          "integration_type",
          "integrationType",
          "integration",
          "protocol",
        ]) ?? "—",
    },
    {
      label: "Status",
      value: formatStatusLabel(
        readDisplayField(device, ["status", "device_status", "deviceStatus", "connection_status"])
      ),
      emphasize: true,
    },
    {
      label: "IP Address",
      value:
        readDisplayField(device, ["ip_address", "ipAddress", "ip", "host", "hostname"]) ?? "—",
    },
    {
      label: "Branch",
      value: (() => {
        const named = readDisplayField(
          device,
          ["branch", "branch_name", "branchName"],
          ["name", "title", "branch_name", "branchName"]
        )
        if (named && !/^\d+$/.test(named)) return named
        const id = readDisplayField(device, ["branch_id", "branchId"])
        if (id) return named && named !== id ? named : `Branch #${id}`
        return named ?? "—"
      })(),
    },
    {
      label: "Timezone",
      value: readDisplayField(device, ["timezone", "time_zone", "timeZone", "tz"]) ?? "—",
    },
    {
      label: "Assigned Employees",
      value: String(assignedEmployees.length),
      emphasize: true,
    },
    {
      label: "Last Synced",
      value: stringifyValue(
        device?.last_synced_at ??
          device?.lastSyncedAt ??
          device?.last_sync_at ??
          device?.synced_at
      ),
    },
  ]
  const attendanceSyncRows = [
    {
      label: "Sync Status",
      value: formatStatusLabel(
        stringifyValue(
          attendanceSyncSnapshot?.status ??
            attendanceSyncSnapshot?.sync_status ??
            attendanceSyncSnapshot?.syncStatus
        )
      ),
    },
    {
      label: "Heartbeat",
      value: stringifyValue(
        attendanceSyncSnapshot?.last_heartbeat_at ??
          attendanceSyncSnapshot?.heartbeat_at ??
          attendanceSyncSnapshot?.lastHeartbeatAt
      ),
    },
    {
      label: "Last Error",
      value: stringifyValue(
        attendanceSyncSnapshot?.last_error ??
          attendanceSyncSnapshot?.error_message ??
          attendanceSyncSnapshot?.lastError
      ),
    },
  ]
  const accessSyncRows = [
    {
      label: "Sync Status",
      value: formatStatusLabel(
        stringifyValue(
          accessSyncSnapshot?.status ??
            accessSyncSnapshot?.sync_status ??
            accessSyncSnapshot?.syncStatus
        )
      ),
    },
    {
      label: "Last Sync",
      value: stringifyValue(
        accessSyncSnapshot?.last_synced_at ??
          accessSyncSnapshot?.updated_at ??
          accessSyncSnapshot?.lastSyncedAt
      ),
    },
    {
      label: "Last Error",
      value: stringifyValue(
        accessSyncSnapshot?.last_error ??
          accessSyncSnapshot?.error_message ??
          accessSyncSnapshot?.lastError
      ),
    },
  ]

  const deviceMetaLine = [
    readDisplayField(device, ["device_code", "deviceCode", "code"]),
    readDisplayField(device, ["ip_address", "ipAddress", "ip"]),
    readDisplayField(device, ["device_model", "deviceModel", "model"]),
  ]
    .filter(Boolean)
    .join(" · ")

  const deviceStatusLabel = formatStatusLabel(
    readDisplayField(device, ["status", "device_status", "deviceStatus"])
  )

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="space-y-3">
        {canOpenAccessControlDevices ? (
          <Link
            href="/dashboard/access-control/devices"
            className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-primary"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Devices
          </Link>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">{deviceName}</h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold",
                  statusTextClass(deviceStatusLabel)
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClass(deviceStatusLabel))} />
                {deviceStatusLabel}
              </span>
            </div>
            {deviceMetaLine ? (
              <p className="mt-1 text-sm text-slate-500">{deviceMetaLine}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onTestConnection()}
              className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={testingConnection}
            >
              {testingConnection ? "Testing…" : "Test connection"}
            </button>
            <button
              type="button"
              onClick={() => void onManageHikvisionDevice()}
              className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={managingDevice}
            >
              {managingDevice ? "Managing…" : "Manage device"}
            </button>
            <button
              type="button"
              onClick={() => void fetchDeviceData()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-primary hover:bg-[color:rgb(var(--primary-rgb)/0.06)]"
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCwIcon className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </div>

      {/* Tabs + content */}
      <div>
        <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
          {[
            ["details", "Details"],
            ["employees", `Employees (${assignedEmployees.length})`],
            ["sync", "Sync"],
            ["logs", "Logs"],
          ].map(([tabKey, label]) => {
            const isActive = activeTab === tabKey
            return (
              <button
                key={tabKey}
                type="button"
                className={cn(
                  "relative -mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
                onClick={() => setActiveTab(tabKey as DeviceTabKey)}
              >
                {label}
              </button>
            )
          })}
        </div>

        {activeTab === "details" ? (
          <div className="space-y-6">
            {/* Properties as a clean 2-col definition list */}
            <dl className="grid gap-x-8 gap-y-0 border-t border-slate-100 sm:grid-cols-2">
              {deviceSummaryRows
                .filter((row) => row.label !== "Device Name" && row.label !== "Status")
                .map((row) => {
                  const missing = isEmptyDisplay(row.value)
                  return (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5"
                    >
                      <dt className="shrink-0 text-sm text-slate-500">{row.label}</dt>
                      <dd
                        className={cn(
                          "text-right text-sm font-medium break-all",
                          missing ? "text-slate-400" : "text-slate-900"
                        )}
                      >
                        {row.value || "—"}
                      </dd>
                    </div>
                  )
                })}
            </dl>

            {/* Health — single panel, two columns, no nested cards */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-900">Health & sync</p>
              <div className="mt-3 grid gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Attendance
                  </p>
                  <dl className="space-y-0">
                    {attendanceSyncRows.map((row) => {
                      const missing = isEmptyDisplay(row.value)
                      const isStatus = row.label.toLowerCase().includes("status")
                      return (
                        <div
                          key={row.label}
                          className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0"
                        >
                          <dt className="text-slate-500">{row.label}</dt>
                          <dd className="text-right">
                            {isStatus && !missing ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 font-semibold",
                                  statusTextClass(row.value)
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    statusDotClass(row.value)
                                  )}
                                />
                                {row.value}
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "font-medium",
                                  missing ? "text-slate-400" : "text-slate-900"
                                )}
                              >
                                {row.value || "—"}
                              </span>
                            )}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Access control
                  </p>
                  <dl className="space-y-0">
                    {accessSyncRows.map((row) => {
                      const missing = isEmptyDisplay(row.value)
                      const isStatus = row.label.toLowerCase().includes("status")
                      return (
                        <div
                          key={row.label}
                          className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0"
                        >
                          <dt className="text-slate-500">{row.label}</dt>
                          <dd className="text-right">
                            {isStatus && !missing ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 font-semibold",
                                  statusTextClass(row.value)
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    statusDotClass(row.value)
                                  )}
                                />
                                {row.value}
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "font-medium",
                                  missing ? "text-slate-400" : "text-slate-900"
                                )}
                              >
                                {row.value || "—"}
                              </span>
                            )}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "employees" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-9 w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-[color:rgb(var(--primary-rgb)/0.18)]"
                  placeholder="Search name or number…"
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500 sm:ml-1">
                {filteredAssignedEmployees.length}
                {employeeSearch.trim()
                  ? ` of ${assignedEmployees.length}`
                  : ""}{" "}
                linked
              </p>
              <button
                type="button"
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium !text-white hover:brightness-95 disabled:opacity-50"
                onClick={() => setAssignEmployeeOpen(true)}
              >
                <PlusIcon className="h-4 w-4" />
                Assign
              </button>
            </div>

            {employeesError ? <p className="text-sm text-red-600">{employeesError}</p> : null}

            {filteredAssignedEmployees.length === 0 ? (
              <div className="border-t border-slate-100 py-10 text-center">
                <p className="text-sm font-medium text-slate-800">
                  {assignedEmployees.length === 0
                    ? "No employees on this device yet"
                    : "No matches for your search"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {assignedEmployees.length === 0
                    ? "Assign someone to start capturing credentials and access."
                    : "Try a different name or employee number."}
                </p>
                {assignedEmployees.length === 0 ? (
                  <button
                    type="button"
                    className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setAssignEmployeeOpen(true)}
                  >
                    <PlusIcon className="h-4 w-4" />
                    Assign employee
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-2.5 pr-3 font-semibold">Employee</th>
                      <th className="px-3 py-2.5 font-semibold">No.</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold">Assigned</th>
                      <th className="py-2.5 pl-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignedEmployees.map((emp, index) => {
                      const empId =
                        readNumberFromRecord(emp, [
                          "resolved_employee_id",
                          "id",
                          "employee_id",
                          "employeeId",
                        ]) ?? index
                      const name = employeeDisplayName(emp)
                      const empNo =
                        readDisplayField(emp, [
                          "resolved_employee_no",
                          "employee_no",
                          "employee_number",
                          "employeeNumber",
                          "user_no",
                        ]) ?? "—"
                      const statusRaw =
                        readDisplayField(emp, [
                          "status",
                          "employment_status",
                          "employmentStatus",
                          "assignment_status",
                          "assignmentStatus",
                          "device_user_status",
                        ]) ?? ""
                      const statusLabel = formatStatusLabel(statusRaw || "active")
                      const assignedAt = stringifyValue(
                        emp.created_at ?? emp.assigned_at ?? emp.updated_at
                      )

                      return (
                        <tr
                          key={`device-emp-${empId}`}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                        >
                          <td className="py-3 pr-3">
                            <p className="font-medium text-slate-900">{name}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{empNo}</td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-semibold",
                                statusTextClass(statusLabel)
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  statusDotClass(statusLabel)
                                )}
                              />
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{assignedAt}</td>
                          <td className="py-3 pl-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-[color:rgb(var(--primary-rgb)/0.08)]"
                                onClick={() => requestManageCredentials(emp)}
                                title="Credentials"
                              >
                                <FingerprintIcon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Credentials</span>
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-[color:rgb(var(--primary-rgb)/0.08)]"
                                onClick={() => {
                                  const token = readStoredToken()
                                  const employeeId = readNumberFromRecord(emp, ["id", "employee_id", "employeeId"])
                                  const cardNo = window.prompt("Card number")
                                  if (!token || employeeId === null || !cardNo) return
                                  void createEmployeeDeviceCard(token, employeeId, deviceId, {
                                    card_no: cardNo,
                                    sync_to_device: true,
                                  })
                                    .then(() => showSuccessAlert("Card created."))
                                    .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Card create failed."))
                                }}
                                title="Add card"
                              >
                                <CreditCardIcon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Card</span>
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                onClick={() => void openEmployeeAuditLogs(emp)}
                                title="Access history"
                              >
                                History
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                onClick={() => requestRemoveEmployee(emp)}
                                title="Remove"
                              >
                                <Trash2Icon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Remove</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "sync" ? (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
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
                    ? "Week plans"
                    : step === "users"
                      ? "Users"
                      : step === "fingerprints"
                        ? "Fingerprints"
                    : step.charAt(0).toUpperCase() + step.slice(1)
              const tone =
                status.state === "success"
                  ? "text-emerald-600"
                  : status.state === "error"
                    ? "text-rose-600"
                    : status.state === "running"
                      ? "text-amber-600"
                      : "text-slate-500"

              return (
                <div
                  key={step}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className={cn("text-xs", tone)}>
                      {status.message ?? (status.state === "idle" ? "Not started" : status.state)}
                    </p>
                  </div>
                  {step === "core" ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={syncingId.length > 0}
                      onClick={() => void onSyncDevice()}
                    >
                      {syncingId.length > 0 ? "Syncing…" : "Sync device"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={!readyForResourceSync || syncingResourceKey === step || syncingId.length > 0}
                      onClick={() => void onSyncDeviceResource(step)}
                    >
                      Sync
                    </button>
                  )}
                </div>
              )
            })}
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">Hikvision attendance</p>
                <p className="text-xs text-slate-500">Pull device attendance logs for a date, then list the latest page.</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const token = readStoredToken()
                  const date = window.prompt("Attendance date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10))
                  if (!token || !date) return
                  void syncHikvisionAttendanceByDate(token, deviceId, { date })
                    .then(() => listHikvisionDeviceAttendanceLogs(token, deviceId, { page: 1, limit: 20 }))
                    .then((rows) => showSuccessAlert(`Attendance sync started. ${rows.length} log rows on this page.`))
                    .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Attendance sync failed."))
                }}
              >
                Sync attendance
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "logs" ? (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Device audit</p>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => void loadDeviceLogs()}
                  disabled={deviceLogsLoading}
                >
                  {deviceLogsLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {deviceAuditLogs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {deviceLogsLoading ? "Loading audit logs…" : "No audit events for this device yet."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3">Action</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Employee</th>
                        <th className="py-2">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviceAuditLogs.map((row, index) => (
                        <tr key={`audit-${readNumberFromRecord(row, ["id"]) ?? index}`} className="border-b border-slate-100">
                          <td className="py-2 pr-3">{readDisplayField(row, ["action", "event"]) || "—"}</td>
                          <td className="py-2 pr-3">{readDisplayField(row, ["status"]) || "—"}</td>
                          <td className="py-2 pr-3">
                            {readDisplayField(row, ["employee_name", "employeeName", "employee_no", "employeeNo"]) || "—"}
                          </td>
                          <td className="py-2">
                            {readDisplayField(row, ["created_at", "createdAt", "updated_at", "updatedAt"]) || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Device commands</p>
              {deviceCommandLogs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {deviceLogsLoading ? "Loading command logs…" : "No command logs for this device yet."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3">Command</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviceCommandLogs.map((row, index) => (
                        <tr key={`cmd-${readNumberFromRecord(row, ["id"]) ?? index}`} className="border-b border-slate-100">
                          <td className="py-2 pr-3">
                            {readDisplayField(row, ["commandType", "command_type", "command"]) || "—"}
                          </td>
                          <td className="py-2 pr-3">{readDisplayField(row, ["status"]) || "—"}</td>
                          <td className="py-2">
                            {readDisplayField(row, ["created_at", "createdAt", "updated_at", "updatedAt"]) || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                          className="rounded-md bg-primary px-3 py-1.5 text-sm !text-white disabled:opacity-50"
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
              className="w-full rounded-md bg-primary px-3 py-1.5 text-sm !text-white disabled:opacity-50 sm:w-auto"
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
        <DialogPopup className="max-h-[90vh] w-[min(96vw,48rem)] overflow-y-auto sm:max-w-[48rem]">
          <DialogHeader>
            <DialogTitle>Manage Device Credentials</DialogTitle>
            <DialogDescription>
              Choose verification mode, credential type, and the finger to capture on this device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {manageCredentialsError ? <p className="text-sm text-red-600">{manageCredentialsError}</p> : null}
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {readStringFromRecord(credentialEmployee ?? {}, ["employee_name"]) ??
                      employeeDisplayName(credentialEmployee ?? {})}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    No.{" "}
                    {readStringFromRecord(credentialEmployee ?? {}, [
                      "resolved_employee_no",
                      "employee_no",
                      "employee_number",
                      "user_no",
                    ]) ?? "—"}{" "}
                    · {deviceName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Verify mode
                  </p>
                  <p className="text-xs font-medium text-primary">
                    {(USER_VERIFY_MODE_OPTIONS.find(
                      (option) => option.value === credentialForm.user_verify_mode
                    )?.label ??
                      credentialForm.user_verify_mode) ||
                      "Not set"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Access credentials</h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pick a type allowed by the employee&apos;s verify mode, then capture or set it.
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <span
                      className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:text-slate-700"
                      aria-label="Credentials help"
                      role="img"
                    >
                      <CircleHelpIcon className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="end" className="max-w-72 text-left leading-relaxed">
                    Only credential types that match the saved verify mode can be used. Fingerprints
                    are captured from the physical device after you save.
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Credential type
                </p>
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
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {credentialForm.credential_type === "PIN" ? "PIN" : "Password"}
                  </span>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-[color:rgb(var(--primary-rgb)/0.2)]"
                    value={credentialForm.pin_password}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        pin_password: event.target.value,
                      }))
                    }
                    placeholder={
                      credentialForm.credential_type === "PIN"
                        ? "Enter PIN"
                        : "Enter password"
                    }
                  />
                </label>
              ) : null}

              {manageCredentialModeReady && isFingerprintCredential ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Which finger?
                  </p>
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

                  {manageFingerprintSlots.length ? (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Saved fingerprints
                      </span>
                      <div className="grid gap-2">
                        {manageFingerprintSlots.map((slot) => {
                          const isRunning = manageFingerprintActionKey.endsWith(`:${slot.id}`)
                          return (
                            <div
                              key={`saved-fingerprint-${slot.id}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
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
                                  {isRunning && manageFingerprintActionKey.startsWith("sync:")
                                    ? "Syncing..."
                                    : "Sync"}
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
                                    void onManageFingerprintAction(
                                      slot.enabled ? "disable" : "enable",
                                      slot.id
                                    )
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

                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700">
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
                </div>
              ) : null}
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
              className="w-full rounded-md bg-primary px-3 py-1.5 text-sm !text-white disabled:opacity-50 sm:w-auto"
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
        <DialogPopup className="w-[min(92vw,24rem)] rounded-md border border-border bg-background p-6 text-foreground shadow-2xl sm:max-w-sm">
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

      <EmployeeAccessRemovalDialog
        open={removalOpen}
        target={removalTarget}
        onOpenChange={(open) => {
          setRemovalOpen(open)
          if (!open) setRemovalTarget(null)
        }}
        onCompleted={() => {
          void fetchDeviceData()
        }}
      />

      <Dialog
        open={employeeLogsOpen}
        onOpenChange={(open) => {
          setEmployeeLogsOpen(open)
          if (!open) {
            setEmployeeLogs([])
            setEmployeeLogsLabel("")
          }
        }}
      >
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Access history</DialogTitle>
            <DialogDescription>{employeeLogsLabel || "Employee audit log"}</DialogDescription>
          </DialogHeader>
          {employeeLogsLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : employeeLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No audit events for this employee on this company yet.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeLogs.map((row, index) => (
                    <tr key={`emp-audit-${readNumberFromRecord(row, ["id"]) ?? index}`} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{readDisplayField(row, ["action", "event"]) || "—"}</td>
                      <td className="py-2 pr-3">{readDisplayField(row, ["status"]) || "—"}</td>
                      <td className="py-2">
                        {readDisplayField(row, ["created_at", "createdAt", "updated_at", "updatedAt"]) || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => setEmployeeLogsOpen(false)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
