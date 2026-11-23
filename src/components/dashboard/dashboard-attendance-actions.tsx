"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { MapPin, Wifi } from "lucide-react";
import {
  ArrowEnter16Regular,
  ArrowExit16Regular,
  Globe16Regular,
} from "@fluentui/react-icons"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Button } from "@/components/ui/button"
import { useFluentToastResultState } from "@/components/ui/use-fluent-toast-state"
import {
  createMyAttendanceCheckIn,
  createMyAttendanceCheckOut,
  getCurrentEmployee,
  getMyAttendanceMobilePunchPolicy,
  getEmployeeDashboard,
  getMyAttendanceToday,
  type AdminRecord,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"
import { asRecord } from "@/utils/token-utils"

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

type AttendanceSelfiePayload = {
  fileName: string
  fileSize: number
  mimeType: string
  fileString: string
}

async function encodeAttendanceSelfie(file: File): Promise<AttendanceSelfiePayload> {
  const image = await createImageBitmap(file)
  const ratio = Math.min(1, 640 / Math.max(image.width, image.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.width * ratio))
  canvas.height = Math.max(1, Math.round(image.height * ratio))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not prepare the selfie image.")
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  let blob: Blob | null = null
  for (const quality of [0.72, 0.58, 0.44, 0.3, 0.2]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (blob && blob.size <= 64 * 1024) break
  }
  if (!blob || blob.size > 64 * 1024) throw new Error("The selfie could not be compressed below 64 KB. Try a closer, well-lit photo.")
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Could not read the selfie image."))
    reader.readAsDataURL(blob!)
  })
  return { fileName: "attendance-selfie.jpg", fileSize: blob.size, mimeType: "image/jpeg", fileString: dataUrl.split(",", 2)[1] ?? "" }
}

function getBrowserInstallationId() {
  const key = "hrms.attendance.installation-id"
  const current = window.localStorage.getItem(key)?.trim()
  if (current) return current
  const created = crypto.randomUUID()
  window.localStorage.setItem(key, created)
  return created
}

const CHECK_IN_KEYS = [
  "checkInAt",
  "check_in_at",
  "firstCheckInAt",
  "first_check_in_at",
  "first_punch",
  "first_punch_at",
  "check_in_time",
  "checkInTime",
  "clock_in_at",
  "clockInAt",
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
  "clock_out_at",
  "clockOutAt",
]

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

function formatAttendanceTime(value: unknown): string {
  if (value == null || value === "") return ""

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 1e12 ? value : value > 1e9 ? value * 1000 : NaN
    if (!Number.isFinite(milliseconds)) return ""
    return new Date(milliseconds).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed.slice(0, 5)

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}

function readAttendanceTime(record: AdminRecord | null, keys: string[]): string {
  if (!record) return ""
  const summary =
    asRecord(record.summary) ??
    asRecord(record.daily_summary) ??
    asRecord(record.dailySummary) ??
    asRecord(record.attendance)

  for (const source of [record, summary]) {
    if (!source) continue
    for (const key of keys) {
      const value = formatAttendanceTime(source[key])
      if (value) return value
    }
  }
  return ""
}

function readBoolean(record: AdminRecord | null, keys: string[]): boolean | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
    if (value === 1 || value === "1" || value === "true") return true
    if (value === 0 || value === "0" || value === "false") return false
  }
  return null
}

function readEmployeeId(record: AdminRecord | null): number | null {
  if (!record) return null
  const nestedEmployee = asRecord(record.employee)
  const rawId = nestedEmployee?.id ?? record.id ?? record.employee_id ?? record.employeeId
  const employeeId = Number(rawId)
  return Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null
}

export function NetworkCheckButton({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [result, setResult] = React.useState<NetworkCheckResult | null>(null)
  const [online, setOnline] = React.useState(true)

  React.useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine)
    updateOnlineState()
    window.addEventListener("online", updateOnlineState)
    window.addEventListener("offline", updateOnlineState)
    return () => {
      window.removeEventListener("online", updateOnlineState)
      window.removeEventListener("offline", updateOnlineState)
    }
  }, [])

  const runCheck = React.useCallback(async () => {
    setOpen(true)
    setChecking(true)

    const connection = getBrowserConnection()
    const locationResult = await requestBrowserLocation()

    setResult({
      online: navigator.onLine,
      transport: connectionTypeLabel(connection?.type),
      effectiveType: connection?.effectiveType?.toUpperCase() ?? null,
      downlink: typeof connection?.downlink === "number" ? connection.downlink : null,
      rtt: typeof connection?.rtt === "number" ? connection.rtt : null,
      saveData: typeof connection?.saveData === "boolean" ? connection.saveData : null,
      ...locationResult,
    })
    setChecking(false)
  }, [])

  return (
    <>
      <Button
        type="button"
        variant={iconOnly ? "ghost" : "outline"}
        size={iconOnly ? "icon-sm" : "sm"}
        className={cn(!iconOnly && "h-8 gap-1.5 px-2.5 text-xs", className)}
        onClick={() => void runCheck()}
        aria-label={iconOnly ? "Check network and location" : undefined}
        title={iconOnly ? "Network check" : undefined}
      >
        <Globe16Regular className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        {iconOnly ? (
          <span
            className={cn(
              "pointer-events-none absolute right-0.5 top-0.5 size-2 rounded-full ring-2 ring-background",
              online ? "bg-emerald-500" : "bg-destructive",
            )}
            aria-hidden
          />
        ) : null}
        {iconOnly ? <span className="sr-only">Network check</span> : "Network check"}
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
                    <p
                      className={cn(
                        "mt-1 text-sm font-semibold",
                        result.online
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive",
                      )}
                    >
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
                    {result.effectiveType
                      ? `${result.effectiveType} estimated quality`
                      : "Quality details are not shared by this browser."}
                  </p>
                  {result.downlink !== null || result.rtt !== null || result.saveData !== null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        result.downlink !== null ? `About ${result.downlink} Mbps` : null,
                        result.rtt !== null ? `${result.rtt} ms response` : null,
                        result.saveData === true ? "Data saver is on" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
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
                  Browsers do not reveal the Wi-Fi name. Attendance uses your permitted location, while the server verifies the approved office network from the request.
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

export function AttendancePunchActions({
  canCheckIn,
  canCheckOut,
  onAttendanceChanged,
  className,
  compact = false,
}: {
  canCheckIn: boolean
  canCheckOut: boolean
  onAttendanceChanged?: () => Promise<void>
  className?: string
  compact?: boolean
}) {
  const [busyAction, setBusyAction] = React.useState<"in" | "out" | null>(null)
  const [selfieFile, setSelfieFile] = React.useState<File | null>(null)
  const [pendingAction, setPendingAction] = React.useState<"in" | "out" | null>(null)
  const [exceptionReason, setExceptionReason] = React.useState("")
  const [punchPolicy, setPunchPolicy] = React.useState<Record<string, unknown>>({})
  const webPunchesDisabled = punchPolicy.allow_web_punches === false
  const [message, setMessage] = React.useState<{
    tone: "success" | "error"
    text: string
  } | null>(null)

  useFluentToastResultState(message, setMessage)

  React.useEffect(() => {
    const token = readStoredSessionTokens().accessToken
    if (!token) return
    let cancelled = false
    void getMyAttendanceMobilePunchPolicy(token).then((value) => {
      if (value && typeof value === "object" && !cancelled) setPunchPolicy(value as Record<string, unknown>)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  // Synchronous guard: state updates are async, so a fast double click could
  // otherwise start two submissions before `busyAction` re-renders.
  const inFlightRef = React.useRef(false)
  // Reused across retries of the same punch so the server's clientRequestId
  // idempotency replays it instead of recording a second punch.
  const requestIdRef = React.useRef<{ action: "in" | "out"; id: string } | null>(null)

  const submitPunch = React.useCallback(
    async (action: "in" | "out") => {
      if (inFlightRef.current || webPunchesDisabled) return
      inFlightRef.current = true
      setMessage(null)
      setBusyAction(action)
      if (requestIdRef.current?.action !== action) {
        requestIdRef.current = { action, id: crypto.randomUUID() }
      }
      const clientRequestId = requestIdRef.current.id

      try {
        const selfieRequired = action === "in"
          ? punchPolicy.require_selfie_for_check_in === true
          : punchPolicy.require_selfie_for_check_out === true
        if (selfieRequired && !selfieFile) {
          throw new Error("Attach a selfie before submitting this attendance punch.")
        }
        if (!navigator.onLine) {
          throw new Error("You appear to be offline. Connect to the office network and try again.")
        }

        const token = readStoredSessionTokens().accessToken
        if (!token) throw new Error("Your session has expired. Please sign in again.")

        const locationResult = await requestBrowserLocation()
        if (!locationResult.location) {
          throw new Error(
            locationResult.locationMessage ||
              "Location permission is required to record attendance.",
          )
        }

        const connection = getBrowserConnection()
        const payload: AdminRecord = {
          clientRequestId,
          latitude: locationResult.location.latitude,
          longitude: locationResult.location.longitude,
          accuracyMeters: locationResult.location.accuracy,
          deviceIdentifier: `web-${getBrowserInstallationId()}`,
          deviceInfo: {
            platform: "web",
            networkType: connection?.type,
          },
        }
        if (selfieFile) payload.selfie = await encodeAttendanceSelfie(selfieFile)
        if (punchPolicy.allow_location_exception_override === true && exceptionReason.trim()) {
          payload.overrideReason = exceptionReason.trim()
        }

        const result = action === "in"
          ? await createMyAttendanceCheckIn(token, payload)
          : await createMyAttendanceCheckOut(token, payload)

        // A punch that failed location validation but carried an exception
        // reason is stored as PENDING_OVERRIDE and does not count as attendance
        // until a manager approves it — don't tell the employee it was recorded.
        const punch = (result as { punch?: { validationStatus?: string } } | null)?.punch
        const pendingReview = punch?.validationStatus === "PENDING_OVERRIDE"
        const label = action === "in" ? "Check-in" : "Check-out"
        setMessage({
          tone: "success",
          text: pendingReview
            ? `${label} submitted for manager approval. It will count once approved.`
            : `${label} recorded.`,
        })
        requestIdRef.current = null
        setSelfieFile(null)
        setExceptionReason("")
        setPendingAction(null)
        await onAttendanceChanged?.().catch(() => undefined)
        window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT))
      } catch (errorObject) {
        setMessage({
          tone: "error",
          text:
            errorObject instanceof Error
              ? errorObject.message
              : `Unable to check ${action === "in" ? "in" : "out"}.`,
        })
      } finally {
        inFlightRef.current = false
        setBusyAction(null)
      }
    },
    [exceptionReason, onAttendanceChanged, punchPolicy, selfieFile, webPunchesDisabled],
  )

  return (
    <div className={cn("mt-2 flex flex-col gap-1.5", className)}>
      {webPunchesDisabled && <p role="status" className="text-sm text-muted-foreground">Web check-in and check-out are disabled by your attendance policy.</p>}
      <Dialog open={pendingAction !== null} onOpenChange={(open) => {
        if (!open && busyAction === null) {
          requestIdRef.current = null
          setPendingAction(null)
          setSelfieFile(null)
          setExceptionReason("")
        }
      }}>
        <DialogPopup from="center" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingAction === "out" ? "Check out" : "Check in"}</DialogTitle>
            <DialogDescription>Confirm your attendance and attach a selfie if required by your attendance policy.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-2 sm:px-6">
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              {(pendingAction === "in" ? punchPolicy.require_selfie_for_check_in : punchPolicy.require_selfie_for_check_out) === true
                ? "Attendance selfie (required by policy)"
                : "Optional attendance selfie"}
              <input
                type="file"
                accept="image/*"
                capture="user"
                aria-label="Attach an attendance selfie"
                disabled={busyAction !== null}
                onChange={(event) => setSelfieFile(event.target.files?.[0] ?? null)}
                className="max-w-[240px] text-xs"
              />
            </label>
            {punchPolicy.allow_location_exception_override === true ? (
              <label className="grid gap-1 text-[11px] text-muted-foreground">
                Location exception reason
                <input value={exceptionReason} disabled={busyAction !== null} onChange={(event) => setExceptionReason(event.target.value)} maxLength={500} placeholder="Explain why location validation failed" className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busyAction !== null} onClick={() => {
              requestIdRef.current = null
              setPendingAction(null)
              setSelfieFile(null)
              setExceptionReason("")
            }}>Cancel</Button>
            <Button type="button" disabled={webPunchesDisabled || busyAction !== null || (pendingAction === "in" ? !canCheckIn : !canCheckOut)} onClick={() => {
              if (pendingAction) void submitPunch(pendingAction)
            }}>{busyAction !== null ? "Submitting…" : pendingAction === "out" ? "Confirm check out" : "Confirm check in"}</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      <div className={cn(
        "flex flex-wrap",
        compact
          ? "items-center gap-2"
          : "gap-2",
      )}>
        <Button
          type="button"
          size={compact ? "xs" : "sm"}
          className={compact
            ? "h-10 min-h-10 min-w-[6rem] gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary/85 px-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-px hover:shadow-md disabled:translate-y-0 disabled:shadow-none disabled:opacity-40"
            : "h-8 gap-1.5 px-2.5 text-xs"}
          disabled={webPunchesDisabled || !canCheckIn || busyAction !== null}
          onClick={() => setPendingAction("in")}
        >
          {busyAction === "in" ? (
            <FluentLoadingIndicator className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowEnter16Regular className="size-4" aria-hidden="true" />
          )}
          {busyAction === "in" ? "Checking in…" : "Check in"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size={compact ? "xs" : "sm"}
          className={compact
            ? "h-10 min-h-10 min-w-[6.25rem] gap-1.5 rounded-lg border-border/70 bg-muted/40 px-3 text-sm font-semibold shadow-none transition-all hover:-translate-y-px hover:border-primary/30 hover:bg-primary/10 disabled:translate-y-0 disabled:border-transparent disabled:bg-muted/50 disabled:text-muted-foreground/55 disabled:opacity-100"
            : "h-8 gap-1.5 px-2.5 text-xs"}
          disabled={webPunchesDisabled || !canCheckOut || busyAction !== null}
          onClick={() => setPendingAction("out")}
        >
          {busyAction === "out" ? (
            <FluentLoadingIndicator className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowExit16Regular className="size-4" aria-hidden="true" />
          )}
          {busyAction === "out" ? "Checking out…" : "Check out"}
        </Button>
      </div>
    </div>
  )
}

type AttendanceQuickState = {
  employeeId: number
  checkIn: string
  checkOut: string
  canCheckIn: boolean
  canCheckOut: boolean
}

export function DashboardAttendanceQuickActions({ mobile = false }: { mobile?: boolean } = {}) {
  const [state, setState] = React.useState<AttendanceQuickState | null>(null)
  const [checked, setChecked] = React.useState(false)

  const loadAttendance = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken
    if (!token) {
      setState(null)
      setChecked(true)
      return
    }

    const [employeeResult, dashboardResult, todayResult] = await Promise.all([
      getCurrentEmployee(token).catch(() => null),
      getEmployeeDashboard(token).catch(() => null),
      getMyAttendanceToday(token).catch(() => null),
    ])

    const employeeRecord = asRecord(employeeResult)
    const dashboardRecord = asRecord(dashboardResult)
    const employeeId =
      readEmployeeId(employeeRecord) ?? readEmployeeId(dashboardRecord)

    if (!employeeId) {
      setState(null)
      setChecked(true)
      return
    }

    const todayRecord = asRecord(todayResult)
    // /me/attendance/today is the authoritative punch state (it counts punches
    // still awaiting approval). The employee dashboard endpoint can be
    // forbidden for admin-type accounts, so it is only a fallback.
    const actionFlags =
      asRecord(todayRecord?.action_flags) ??
      asRecord(todayRecord?.actionFlags) ??
      asRecord(dashboardRecord?.action_flags) ??
      asRecord(dashboardRecord?.actionFlags)
    const checkIn = readAttendanceTime(todayRecord, CHECK_IN_KEYS)
    const checkOut = readAttendanceTime(todayRecord, CHECK_OUT_KEYS)
    const explicitCanCheckIn = readBoolean(actionFlags, ["can_check_in", "canCheckIn"])
    const explicitCanCheckOut = readBoolean(actionFlags, ["can_check_out", "canCheckOut"])

    setState({
      employeeId,
      checkIn,
      checkOut,
      canCheckIn: explicitCanCheckIn ?? !checkIn,
      canCheckOut: explicitCanCheckOut ?? Boolean(checkIn && !checkOut),
    })
    setChecked(true)
  }, [])

  React.useEffect(() => {
    void loadAttendance()
  }, [loadAttendance])
  useAttendanceChangedListener(loadAttendance)

  if (!checked || !state) return null

  const statusLabel = state.checkOut
    ? "Day complete"
    : state.checkIn
      ? "On shift"
      : "Ready to start"
  const statusDetail = state.checkIn
    ? state.checkOut
      ? `${state.checkIn} – ${state.checkOut}`
      : `In ${state.checkIn}`
    : "No check-in yet"

  return (
    <div className={cn(
      "relative flex items-center gap-2",
      mobile && "w-full justify-center",
    )}>
      <div className="hidden min-w-[76px] flex-col pl-1 leading-tight 2xl:flex">
        <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
          <span className={cn("size-1.5 rounded-full ring-2 ring-background", state.checkOut ? "bg-muted-foreground/50" : "bg-emerald-500")} />
          {statusLabel}
        </span>
        <span className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{statusDetail}</span>
      </div>
      <AttendancePunchActions
        canCheckIn={state.canCheckIn}
        canCheckOut={state.canCheckOut}
        onAttendanceChanged={loadAttendance}
        compact
        className="relative mt-0 items-center"
      />
    </div>
  )
}

// Fired after any successful punch so every attendance widget on the page
// (header quick actions, the Today panel) reloads the same server state.
export const ATTENDANCE_CHANGED_EVENT = "hrms:attendance-changed"

function useAttendanceChangedListener(reload: () => Promise<void>) {
  React.useEffect(() => {
    const handler = () => { void reload() }
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, handler)
    return () => window.removeEventListener(ATTENDANCE_CHANGED_EVENT, handler)
  }, [reload])
}

type TodayPunch = { punch_type?: string; punch_time?: string; validation_status?: string }

function formatClock(value: unknown, timeZone?: string) {
  if (typeof value !== "string" || !value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone })
}

function formatMinutes(value: unknown) {
  const minutes = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`
}

const STATE_COPY: Record<string, { label: string; tone: string }> = {
  not_checked_in: { label: "Not checked in", tone: "bg-slate-400" },
  checked_in: { label: "Checked in", tone: "bg-emerald-500" },
  checked_out: { label: "Day complete", tone: "bg-sky-500" },
}

export function AttendanceTodayPanel() {
  const [today, setToday] = React.useState<AdminRecord | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken
    if (!token) { setError("Your session has expired. Please sign in again."); return }
    try {
      setToday(asRecord(await getMyAttendanceToday(token)))
      setError(null)
    } catch (errorObject) {
      setError(errorObject instanceof Error ? errorObject.message : "Could not load today's attendance.")
    }
  }, [])

  React.useEffect(() => { void load() }, [load])
  useAttendanceChangedListener(load)

  if (error) return <p role="alert" className="py-4 text-sm text-destructive">{error}</p>
  if (!today) return <div className="py-6"><FluentLoadingIndicator /></div>

  const summary = asRecord(today.summary)
  const flags = asRecord(today.action_flags)
  const timeZone = typeof summary?.timezone === "string" ? summary.timezone : undefined
  const punches = (Array.isArray(today.punches) ? today.punches : []) as TodayPunch[]
  const live = punches.filter((p) => p.validation_status !== "REJECTED" && p.validation_status !== "OVERRIDE_REJECTED")
  const checkInPunch = live.find((p) => p.punch_type === "CHECK_IN")
  const checkOutPunch = [...live].reverse().find((p) => p.punch_type === "CHECK_OUT")
  const pendingReview = live.some((p) => p.validation_status === "PENDING_OVERRIDE")
  const state = STATE_COPY[String(today.punch_state)] ?? STATE_COPY.not_checked_in
  const late = Number(summary?.late_minutes ?? 0)
  const early = Number(summary?.early_departure_minutes ?? 0)

  const stats: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: "Shift",
      value: summary?.schedule_start_at
        ? `${formatClock(summary.schedule_start_at, timeZone)} – ${formatClock(summary.schedule_end_at, timeZone)}`
        : "No shift assigned",
    },
    { label: "Check-in", value: formatClock(summary?.check_in_at ?? checkInPunch?.punch_time, timeZone), hint: late > 0 ? `${late} min late` : undefined },
    { label: "Check-out", value: formatClock(summary?.check_out_at ?? checkOutPunch?.punch_time, timeZone), hint: early > 0 ? `${early} min early` : undefined },
    { label: "Worked", value: formatMinutes(summary?.work_minutes) },
  ]

  return (
    <section aria-labelledby="attendance-today-title" className="flex max-w-3xl flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h2 id="attendance-today-title" className="text-sm font-semibold text-foreground">Today</h2>
          <span className="flex items-center gap-2 text-sm text-foreground" aria-live="polite">
            <span aria-hidden className={cn("size-2 rounded-full", state.tone)} />
            {state.label}
            {/* The summary status lags pending punches (it says "absent" until a
                manager approves), so only show it once the summary has a check-in. */}
            {summary?.attendance_status && summary?.check_in_at ? (
              <span className="text-xs text-muted-foreground">· {String(summary.attendance_status).replace(/_/g, " ").toLowerCase()}</span>
            ) : null}
          </span>
          {pendingReview ? (
            <span className="text-xs text-amber-700 dark:text-amber-400">A punch is awaiting manager approval and will count once approved.</span>
          ) : null}
        </div>
        <AttendancePunchActions
          canCheckIn={flags?.can_check_in === true}
          canCheckOut={flags?.can_check_out === true}
          onAttendanceChanged={load}
          className="mt-0 items-end"
        />
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{item.value}</dd>
            {item.hint ? <dd className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{item.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  )
}
