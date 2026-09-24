"use client"

import * as React from "react"
import {
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Network,
  Wifi,
} from "lucide-react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Button } from "@/components/ui/button"
import {
  createAttendanceMobilePunchCheckIn,
  createAttendanceMobilePunchCheckOut,
  getCurrentEmployee,
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
          "Location requires HTTPS. Use localhost during development or open the deployed secure site.",
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
        <Network aria-hidden="true" />
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
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
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
  employeeId,
  canCheckIn,
  canCheckOut,
  onAttendanceChanged,
  className,
  messageClassName,
  compact = false,
}: {
  employeeId: number
  canCheckIn: boolean
  canCheckOut: boolean
  onAttendanceChanged?: () => Promise<void>
  className?: string
  messageClassName?: string
  compact?: boolean
}) {
  const [busyAction, setBusyAction] = React.useState<"in" | "out" | null>(null)
  const [message, setMessage] = React.useState<{
    tone: "success" | "error"
    text: string
  } | null>(null)

  const submitPunch = React.useCallback(
    async (action: "in" | "out") => {
      setMessage(null)
      setBusyAction(action)

      try {
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
    <div className={cn("mt-2 flex flex-col gap-1.5", className)}>
      <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-2")}>
        <Button
          type="button"
          size={compact ? "xs" : "sm"}
          className={compact ? "h-6 gap-1 rounded-md px-2 text-[10px]" : "h-8 gap-1.5 px-2.5 text-xs"}
          disabled={!canCheckIn || busyAction !== null}
          onClick={() => void submitPunch("in")}
        >
          {busyAction === "in" ? (
            <Loader2 className={cn(compact ? "size-3" : "size-3.5", "animate-spin")} aria-hidden="true" />
          ) : (
            <LogIn className={compact ? "size-3" : "size-3.5"} aria-hidden="true" />
          )}
          {busyAction === "in" ? "Checking in…" : "Check in"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size={compact ? "xs" : "sm"}
          className={compact ? "h-6 gap-1 rounded-md px-2 text-[10px]" : "h-8 gap-1.5 px-2.5 text-xs"}
          disabled={!canCheckOut || busyAction !== null}
          onClick={() => void submitPunch("out")}
        >
          {busyAction === "out" ? (
            <Loader2 className={cn(compact ? "size-3" : "size-3.5", "animate-spin")} aria-hidden="true" />
          ) : (
            <LogOut className={compact ? "size-3" : "size-3.5"} aria-hidden="true" />
          )}
          {busyAction === "out" ? "Checking out…" : "Check out"}
        </Button>
      </div>
      {message ? (
        <p
          className={cn(
            "text-xs",
            message.tone === "success"
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-destructive",
            messageClassName,
          )}
          role="status"
        >
          {message.text}
        </p>
      ) : null}
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

export function DashboardAttendanceQuickActions() {
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
    const actionFlags =
      asRecord(dashboardRecord?.action_flags) ?? asRecord(dashboardRecord?.actionFlags)
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

  if (!checked || !state) return null

  return (
    <div className="relative flex items-center justify-center">
      <AttendancePunchActions
        employeeId={state.employeeId}
        canCheckIn={state.canCheckIn}
        canCheckOut={state.canCheckOut}
        onAttendanceChanged={loadAttendance}
        compact
        className="relative mt-0 items-center"
        messageClassName="absolute left-1/2 top-[calc(100%+0.5rem)] z-10 -translate-x-1/2 whitespace-nowrap border border-border bg-popover px-3 py-1.5 text-popover-foreground shadow-md"
      />
    </div>
  )
}
