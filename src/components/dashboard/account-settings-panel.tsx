"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  CheckCircle2,
  Copy,
  ImageIcon,
  KeyRound,
  LogOut,
  Loader2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import {
  extractBackupCodes,
  listMyNotificationPreferences,
  setMyNotificationPreference,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationPreferenceType,
} from "@/lib/admin-api"
import { clearStoredSession, readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { authService } from "@/services/authService"
import type { AuthSessionRecord, TwoFactorSetupResponse } from "@/types"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { AUTH_STORAGE_KEYS, ROUTES } from "@/utils/constants"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface AccountSettingsPanelProps {
  token: string
  loading: boolean
  onChangeMyPassword: (oldPassword: string, newPassword: string) => Promise<void>
  profilePhotoUrl?: string | null
  displayName?: string | null
  profilePictureHref?: string | null
}

type SecurityTab = "reset-password" | "two-factor" | "devices" | "email"

const NOTIFICATION_PREFERENCE_CHANNELS: NotificationChannel[] = [
  "IN_APP",
  "EMAIL",
  "SMS",
  "PUSH",
]

const NOTIFICATION_PREFERENCE_GROUPS: Array<{
  title: string
  types: NotificationPreferenceType[]
}> = [
  {
    title: "General",
    types: ["GENERAL", "AUTH_SECURITY", "ACCESS_CHANGE", "SYSTEM_ALERT"],
  },
  {
    title: "Leave",
    types: [
      "LEAVE_SUBMITTED",
      "LEAVE_APPROVAL_REQUIRED",
      "LEAVE_APPROVED",
      "LEAVE_REJECTED",
      "LEAVE_RETURNED_FOR_CORRECTION",
      "LEAVE_CANCELLED",
    ],
  },
  {
    title: "Onboarding",
    types: [
      "ONBOARDING_SUBMITTED",
      "ONBOARDING_APPROVAL_REQUIRED",
      "ONBOARDING_APPROVED",
      "ONBOARDING_REJECTED",
      "ONBOARDING_TASK_ASSIGNED",
      "ONBOARDING_TASK_OVERDUE",
      "ONBOARDING_APPROVAL_REMINDER",
      "ONBOARDING_COMPLETED",
    ],
  },
  {
    title: "Offboarding",
    types: [
      "OFFBOARDING_SUBMITTED",
      "OFFBOARDING_APPROVAL_REQUIRED",
      "OFFBOARDING_APPROVED",
      "OFFBOARDING_TASK_ASSIGNED",
      "OFFBOARDING_TASK_OVERDUE",
      "OFFBOARDING_APPROVAL_REMINDER",
      "OFFBOARDING_CLEARANCE_REQUIRED",
      "OFFBOARDING_CLEARANCE_OVERDUE",
      "OFFBOARDING_ASSET_OVERDUE",
      "OFFBOARDING_SETTLEMENT_OVERDUE",
      "OFFBOARDING_COMPLETED",
    ],
  },
  {
    title: "Attendance",
    types: ["ATTENDANCE_CORRECTION"],
  },
]

function securityTabFromQuery(value: string | null): SecurityTab {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "two-factor" || normalized === "2fa" || normalized === "mfa") return "two-factor"
  if (normalized === "devices" || normalized === "device") return "devices"
  if (normalized === "email" || normalized === "verify-email" || normalized === "verify") return "email"
  if (normalized === "password" || normalized === "reset-password") return "reset-password"
  return "reset-password"
}

function resolveQrImageSrc(qrCode?: string | null): string | null {
  if (!qrCode?.trim()) return null
  const value = qrCode.trim()
  if (value.startsWith("data:image")) return value
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`
  }
  // Common API shape: raw base64 PNG/JPEG
  const compact = value.replace(/\s+/g, "")
  if (compact.length > 80 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
    const mime = compact.startsWith("/9j/") ? "image/jpeg" : "image/png"
    return `data:${mime};base64,${compact}`
  }
  return null
}

function normalizeTotpCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6)
}

function formatSessionTimestamp(value?: string) {
  if (!value?.trim()) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

function formatNotificationPreferenceLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildNotificationPreferenceKey(
  notificationType: NotificationPreferenceType,
  channel: NotificationChannel
) {
  return `${notificationType}:${channel}`
}

function readNotificationPreferenceType(
  preference: NotificationPreference | null | undefined
): NotificationPreferenceType | null {
  const value = preference?.notification_type ?? preference?.notificationType
  return typeof value === "string" && value.trim()
    ? (value.trim().toUpperCase() as NotificationPreferenceType)
    : null
}

function readNotificationPreferenceChannel(
  preference: NotificationPreference | null | undefined
): NotificationChannel | null {
  const value = preference?.channel
  return typeof value === "string" && value.trim()
    ? (value.trim().toUpperCase() as NotificationChannel)
    : null
}

function readNotificationPreferenceEnabled(
  preference: NotificationPreference | null | undefined
) {
  if (!preference) return false
  if (typeof preference.is_enabled === "boolean") return preference.is_enabled
  if (typeof preference.isEnabled === "boolean") return preference.isEnabled
  return false
}

function resolveFreshAccessToken(fallbackToken: string) {
  if (typeof window === "undefined") {
    return fallbackToken.trim()
  }
  const stored = readStoredSessionTokens().accessToken.trim()
  return stored || fallbackToken.trim()
}

function buildSettingsTabHref(pathname: string | null, searchParams: ReturnType<typeof useSearchParams>, tab: SecurityTab) {
  const params = new URLSearchParams(searchParams?.toString() ?? "")
  params.set("tab", tab)
  const query = params.toString()
  const safePathname = pathname?.trim() || "/dashboard"
  return query ? `${safePathname}?${query}` : safePathname
}

function AccountSettingsPanelLoadingFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security & Authentication</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Loading security settings...
      </CardContent>
    </Card>
  )
}

function AccountSettingsPanelContent({
  token,
  loading,
  onChangeMyPassword,
  profilePhotoUrl,
  displayName,
  profilePictureHref,
}: AccountSettingsPanelProps) {
  const router = useRouter()
  const actor = useDashboardActor()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [hasHydrated, setHasHydrated] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<SecurityTab>("reset-password")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")

  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false)
  const [emailVerified, setEmailVerified] = React.useState(false)
  const [securityLoading, setSecurityLoading] = React.useState(false)
  const [twoFactorBusy, setTwoFactorBusy] = React.useState(false)
  const [setupData, setSetupData] = React.useState<TwoFactorSetupResponse | null>(null)
  const [verifyCode, setVerifyCode] = React.useState("")
  const [disableCode, setDisableCode] = React.useState("")
  const [backupCodes, setBackupCodes] = React.useState<string[]>([])
  const [regenerateCode, setRegenerateCode] = React.useState("")
  const [regenerateBusy, setRegenerateBusy] = React.useState(false)
  const [accountEmail, setAccountEmail] = React.useState("")
  const [emailBusy, setEmailBusy] = React.useState(false)
  const [sessions, setSessions] = React.useState<AuthSessionRecord[]>([])
  const [sessionsLoading, setSessionsLoading] = React.useState(false)
  const [sessionActionId, setSessionActionId] = React.useState<string | null>(null)
  const [sessionMessage, setSessionMessage] = React.useState<string | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [logoutAllBusy, setLogoutAllBusy] = React.useState(false)
  const [notificationPreferences, setNotificationPreferences] = React.useState<NotificationPreference[]>([])
  const [notificationPreferencesLoading, setNotificationPreferencesLoading] = React.useState(false)
  const [notificationPreferencesError, setNotificationPreferencesError] = React.useState<string | null>(null)
  const [notificationPreferenceBusyKey, setNotificationPreferenceBusyKey] = React.useState<string | null>(null)
  const canManageDefaultAvatars =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/settings/default-avatars",
      actor.permissionLabels,
      actor.accessMode
    )

  React.useEffect(() => {
    setHasHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hasHydrated) {
      return
    }
    setActiveTab(securityTabFromQuery(searchParams?.get("tab") ?? null))
  }, [hasHydrated, searchParams])

  const handleTabChange = React.useCallback(
    (tab: SecurityTab) => {
      const nextHref = buildSettingsTabHref(pathname, searchParams, tab)
      router.replace(nextHref, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const refreshSecurityFlags = React.useCallback(async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) return
    setSecurityLoading(true)
    try {
      const [flags, currentUser] = await Promise.all([
        authService.getSecurityFlags(accessToken),
        authService.getCurrentUser(accessToken).catch(() => null),
      ])
      setTwoFactorEnabled(flags.isTwoFactorEnabled)
      setEmailVerified(flags.isEmailVerified)
      if (currentUser?.email) {
        setAccountEmail(currentUser.email)
      }
    } catch {
      // Keep last known state if status fetch fails.
    } finally {
      setSecurityLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    void refreshSecurityFlags()
  }, [refreshSecurityFlags])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw) as { email?: unknown }
      if (typeof parsed.email === "string" && parsed.email.trim()) {
        setAccountEmail(parsed.email.trim())
      }
    } catch {
      // Ignore malformed local session cache and fall back to API refresh.
    }
  }, [])

  const loadSessions = React.useCallback(async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) return
    setSessionsLoading(true)
    setSessionError(null)
    setSessionMessage(null)
    try {
      const nextSessions = await authService.listSessions(accessToken)
      setSessions(nextSessions)
    } catch (errorObject) {
      setSessions([])
      setSessionError(
        errorObject instanceof Error ? errorObject.message : "Could not load active sessions."
      )
    } finally {
      setSessionsLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    if (activeTab === "devices") {
      void loadSessions()
    }
  }, [activeTab, loadSessions])

  const loadNotificationPreferences = React.useCallback(async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      setNotificationPreferences([])
      return
    }

    setNotificationPreferencesLoading(true)
    setNotificationPreferencesError(null)
    try {
      const rows = await listMyNotificationPreferences(accessToken)
      setNotificationPreferences(rows)
    } catch (errorObject) {
      setNotificationPreferences([])
      setNotificationPreferencesError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load notification preferences."
      )
    } finally {
      setNotificationPreferencesLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    void loadNotificationPreferences()
  }, [loadNotificationPreferences])

  const tabIndex =
    activeTab === "reset-password"
      ? 0
      : activeTab === "two-factor"
        ? 1
        : activeTab === "devices"
          ? 2
          : 3
  const avatarLabel = displayName?.trim() || "Your profile"
  const initials =
    avatarLabel
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"

  const qrImageSrc = resolveQrImageSrc(setupData?.qrCode)
  const notificationPreferencesByKey = React.useMemo(() => {
    const map = new Map<string, NotificationPreference>()
    notificationPreferences.forEach((preference) => {
      const notificationType = readNotificationPreferenceType(preference)
      const channel = readNotificationPreferenceChannel(preference)
      if (!notificationType || !channel) return
      map.set(buildNotificationPreferenceKey(notificationType, channel), preference)
    })
    return map
  }, [notificationPreferences])

  const handleChangePassword = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.error("Current and new passwords are required.")
      return
    }

    try {
      await onChangeMyPassword(currentPassword, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      showSuccessAlert("Password changed.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Password change failed."
      toast.error(message)
    }
  }

  const handleStartTwoFactorSetup = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    setTwoFactorBusy(true)
    try {
      const setup = await authService.setupTwoFactor(accessToken)
      setSetupData(setup)
      setVerifyCode("")
      toast.message("Scan the QR code with your authenticator app, then enter the 6-digit code.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not start 2FA setup."
      toast.error(message)
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleVerifyTwoFactor = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    const code = normalizeTotpCode(verifyCode)
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.")
      return
    }
    setTwoFactorBusy(true)
    try {
      const verifyResult = await authService.verifyTwoFactor(accessToken, code)
      const nextBackupCodes = extractBackupCodes(verifyResult)
      setSetupData(null)
      setVerifyCode("")
      setTwoFactorEnabled(true)
      if (nextBackupCodes.length > 0) {
        setBackupCodes(nextBackupCodes)
        showSuccessAlert("Two-factor authentication is now enabled. Save your backup codes.")
      } else {
        showSuccessAlert("Two-factor authentication is now enabled.")
      }
      void refreshSecurityFlags()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Invalid 2FA code."
      toast.error(message)
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleDisableTwoFactor = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    const code = normalizeTotpCode(disableCode)
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.")
      return
    }
    setTwoFactorBusy(true)
    try {
      await authService.disableTwoFactor(accessToken, code)
      setDisableCode("")
      setSetupData(null)
      setBackupCodes([])
      setRegenerateCode("")
      setTwoFactorEnabled(false)
      showSuccessAlert("Two-factor authentication has been disabled.")
      void refreshSecurityFlags()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not disable 2FA."
      toast.error(message)
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    const code = regenerateCode.trim()
    if (!code) {
      toast.error("Enter an authenticator code or unused backup code.")
      return
    }
    setRegenerateBusy(true)
    try {
      const nextCodes = await authService.regenerateBackupCodes(accessToken, code)
      if (nextCodes.length === 0) {
        throw new Error("The server did not return new backup codes.")
      }
      setBackupCodes(nextCodes)
      setRegenerateCode("")
      showSuccessAlert("New backup codes generated. Store them in a safe place.")
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Could not regenerate backup codes."
      toast.error(message)
    } finally {
      setRegenerateBusy(false)
    }
  }

  const handleCopyBackupCodes = async () => {
    if (backupCodes.length === 0) return
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"))
      toast.success("Backup codes copied.")
    } catch {
      toast.error("Could not copy backup codes.")
    }
  }

  const handleCopySecret = async () => {
    if (!setupData?.secret) return
    try {
      await navigator.clipboard.writeText(setupData.secret)
      toast.success("Secret copied.")
    } catch {
      toast.error("Could not copy secret.")
    }
  }

  const handleCancelSetup = () => {
    setSetupData(null)
    setVerifyCode("")
  }

  const handleResendVerification = async () => {
    if (!accountEmail.trim()) {
      toast.error("We could not determine which email address to verify.")
      return
    }
    setEmailBusy(true)
    try {
      await authService.resendVerification(accountEmail)
      showSuccessAlert(`Verification link sent to ${accountEmail}.`)
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Could not resend verification email."
      toast.error(message)
    } finally {
      setEmailBusy(false)
    }
  }

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    setSessionActionId(sessionId)
    setSessionError(null)
    setSessionMessage(null)
    try {
      await authService.revokeSession(accessToken, sessionId)
      if (isCurrent) {
        clearStoredSession()
        window.location.assign(ROUTES.login)
        return
      }
      setSessionMessage("Session revoked.")
      await loadSessions()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not revoke session."
      setSessionError(message)
      toast.error(message)
    } finally {
      setSessionActionId(null)
    }
  }

  const handleLogoutAllSessions = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    setLogoutAllBusy(true)
    setSessionError(null)
    setSessionMessage(null)
    try {
      await authService.logoutAll(accessToken)
      clearStoredSession()
      window.location.assign(ROUTES.login)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not sign out all sessions."
      setSessionError(message)
      toast.error(message)
    } finally {
      setLogoutAllBusy(false)
    }
  }

  const handleToggleNotificationPreference = async (
    notificationType: NotificationPreferenceType,
    channel: NotificationChannel,
    nextEnabled: boolean
  ) => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }

    const key = buildNotificationPreferenceKey(notificationType, channel)
    setNotificationPreferenceBusyKey(key)
    setNotificationPreferencesError(null)
    try {
      const updated = await setMyNotificationPreference(accessToken, {
        notification_type: notificationType,
        channel,
        is_enabled: nextEnabled,
      })
      const nextPreference =
        updated ??
        ({
          notification_type: notificationType,
          channel,
          is_enabled: nextEnabled,
        } satisfies NotificationPreference)

      setNotificationPreferences((current) => {
        const next = [...current]
        const index = next.findIndex((preference) => {
          return (
            readNotificationPreferenceType(preference) === notificationType &&
            readNotificationPreferenceChannel(preference) === channel
          )
        })
        if (index >= 0) {
          next[index] = nextPreference
          return next
        }
        return [...next, nextPreference]
      })
      toast.success(
        `${formatNotificationPreferenceLabel(notificationType)} ${formatNotificationPreferenceLabel(channel)} notifications ${nextEnabled ? "enabled" : "disabled"}.`
      )
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update the notification preference."
      setNotificationPreferencesError(message)
      toast.error(message)
    } finally {
      setNotificationPreferenceBusyKey(null)
    }
  }

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      {profilePictureHref ? (
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-14 ring-1 ring-border" size="lg">
                {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={avatarLabel} /> : null}
                <AvatarFallback className="text-base font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{avatarLabel}</p>
                <p className="text-sm text-muted-foreground">
                  Update the photo shown on your dashboard, profile, and account menu.
                </p>
              </div>
            </div>
            <Link
              href={profilePictureHref}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground self-start sm:self-auto"
            >
              <ImageIcon className="size-4" />
              Change Profile Picture
            </Link>
          </CardContent>
        </Card>
      ) : null}
      {canManageDefaultAvatars ? (
        <Card>
          <CardHeader>
            <CardTitle>Company default avatars</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Manage the gallery of default profile avatars employees can choose from (by gender category).
            </p>
            <Link
              href="/dashboard/settings/default-avatars"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground self-start sm:self-auto"
            >
              <ImageIcon className="size-4" />
              Manage avatars
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Security & Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative grid grid-cols-2 gap-2 rounded-lg border p-1 sm:grid-cols-4">
            <div
              className="absolute top-1 bottom-1 left-1 hidden rounded-md bg-muted transition-all duration-300 ease-out sm:block"
              style={{
                width: "calc((100% - 1.25rem) / 4)",
                transform:
                  activeTab === "reset-password"
                    ? "translateX(0%)"
                    : activeTab === "two-factor"
                      ? "translateX(100%)"
                      : activeTab === "devices"
                        ? "translateX(200%)"
                        : "translateX(300%)",
              }}
            />
            <Button
              type="button"
              variant="ghost"
              className="relative z-10 justify-center gap-2 px-2 text-xs sm:text-sm"
              onClick={() => handleTabChange("reset-password")}
            >
              <KeyRound
                className={`size-4 transition-all duration-300 ${
                  activeTab === "reset-password"
                    ? "text-blue-600 dark:text-blue-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              Password
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="relative z-10 justify-center gap-2 px-2 text-xs sm:text-sm"
              onClick={() => handleTabChange("two-factor")}
            >
              <ShieldCheck
                className={`size-4 transition-all duration-300 ${
                  activeTab === "two-factor"
                    ? "text-emerald-600 dark:text-emerald-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              2FA
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="relative z-10 justify-center gap-2 px-2 text-xs sm:text-sm"
              onClick={() => handleTabChange("devices")}
            >
              <Smartphone
                className={`size-4 transition-all duration-300 ${
                  activeTab === "devices"
                    ? "text-violet-600 dark:text-violet-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              Devices
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="relative z-10 justify-center gap-2 px-2 text-xs sm:text-sm"
              onClick={() => handleTabChange("email")}
            >
              <MailCheck
                className={`size-4 transition-all duration-300 ${
                  activeTab === "email"
                    ? "text-amber-600 dark:text-amber-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              Email
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div
              className="flex w-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${tabIndex * 100}%)` }}
            >
              <div className="w-full shrink-0 p-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Current Password</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </div>
                  <Button onClick={handleChangePassword} disabled={loading}>
                    Change Password
                  </Button>
                </div>
              </div>

              <div className="w-full shrink-0 p-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                    {securityLoading ? (
                      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : twoFactorEnabled ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ShieldOff className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {securityLoading
                          ? "Checking 2FA status…"
                          : twoFactorEnabled
                            ? "Two-factor authentication is enabled"
                            : "Two-factor authentication is not enabled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Use an authenticator app (Google Authenticator, Authy, Microsoft Authenticator) to
                        generate one-time codes when signing in.
                      </p>
                    </div>
                  </div>

                  {!twoFactorEnabled && !setupData ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Set up 2FA to require a code from your phone in addition to your password.
                      </p>
                      <Button onClick={handleStartTwoFactorSetup} disabled={twoFactorBusy || !token}>
                        {twoFactorBusy ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Starting setup…
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="size-4" />
                            Set up 2FA
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}

                  {!twoFactorEnabled && setupData ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                        <div className="flex flex-col items-center gap-2">
                          {qrImageSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={qrImageSrc}
                              alt="2FA QR code"
                              className="size-40 rounded-lg border bg-white p-2 shadow-sm"
                            />
                          ) : (
                            <div className="flex size-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                              QR image unavailable. Use the secret below.
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label>Manual secret</Label>
                            <div className="flex gap-2">
                              <Input
                                readOnly
                                value={setupData.secret}
                                className="font-mono text-xs"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleCopySecret}
                                aria-label="Copy secret"
                              >
                                <Copy className="size-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              If you cannot scan the QR code, enter this secret manually in your app.
                            </p>
                          </div>
                          {setupData.otpAuthUrl ? (
                            <p className="break-all font-mono text-[10px] text-muted-foreground">
                              {setupData.otpAuthUrl}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-2 border-t pt-3">
                        <Label htmlFor="verify-2fa-code">Authenticator code</Label>
                        <Input
                          id="verify-2fa-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={verifyCode}
                          onChange={(event) => setVerifyCode(normalizeTotpCode(event.target.value))}
                          className="max-w-[10rem] font-mono tracking-[0.2em]"
                        />
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            onClick={handleVerifyTwoFactor}
                            disabled={twoFactorBusy || verifyCode.length !== 6}
                          >
                            {twoFactorBusy ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Verifying…
                              </>
                            ) : (
                              "Verify & activate"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelSetup}
                            disabled={twoFactorBusy}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {twoFactorEnabled ? (
                    <div className="space-y-3 border-t pt-3">
                      {backupCodes.length > 0 ? (
                        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">Backup codes</p>
                              <p className="text-xs text-muted-foreground">
                                Store these somewhere safe. Each code can be used once if you lose your authenticator.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleCopyBackupCodes()}
                            >
                              <Copy className="size-3.5" />
                              Copy
                            </Button>
                          </div>
                          <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
                            {backupCodes.map((code) => (
                              <li key={code} className="rounded-md border bg-background px-2 py-1">
                                {code}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Regenerate backup codes</p>
                        <p className="text-xs text-muted-foreground">
                          This replaces any unused backup codes. Enter a current authenticator code or an unused backup code.
                        </p>
                        <Label htmlFor="regenerate-2fa-code">Authenticator or backup code</Label>
                        <Input
                          id="regenerate-2fa-code"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={regenerateCode}
                          onChange={(event) => setRegenerateCode(event.target.value)}
                          className="max-w-[14rem] font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRegenerateBackupCodes()}
                          disabled={regenerateBusy || twoFactorBusy || !regenerateCode.trim()}
                        >
                          {regenerateBusy ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Regenerating…
                            </>
                          ) : (
                            <>
                              <KeyRound className="size-4" />
                              Generate new backup codes
                            </>
                          )}
                        </Button>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        To disable 2FA, enter a current code from your authenticator app.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="disable-2fa-code">Authenticator code</Label>
                        <Input
                          id="disable-2fa-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={disableCode}
                          onChange={(event) => setDisableCode(normalizeTotpCode(event.target.value))}
                          className="max-w-[10rem] font-mono tracking-[0.2em]"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        onClick={handleDisableTwoFactor}
                        disabled={twoFactorBusy || disableCode.length !== 6}
                      >
                        {twoFactorBusy ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Disabling…
                          </>
                        ) : (
                          <>
                            <ShieldOff className="size-4" />
                            Disable 2FA
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="w-full shrink-0 p-4">
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Active sessions</p>
                      <p className="text-xs text-muted-foreground">
                        Review the devices and browsers currently signed in to your account.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadSessions()}
                        disabled={sessionsLoading || !token}
                      >
                        {sessionsLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Refresh
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleLogoutAllSessions}
                        disabled={logoutAllBusy || !token}
                      >
                        {logoutAllBusy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                        Sign out all
                      </Button>
                    </div>
                  </div>

                  {sessionMessage ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                      {sessionMessage}
                    </div>
                  ) : null}
                  {sessionError ? (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                      {sessionError}
                    </div>
                  ) : null}

                  {sessionsLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading active sessions...
                    </div>
                  ) : sessionError ? null : sessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      No active sessions were returned for this account.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map((session) => {
                        const createdAt = formatSessionTimestamp(session.createdAt)
                        const lastUsedAt = formatSessionTimestamp(session.lastUsedAt)
                        const expiresAt = formatSessionTimestamp(session.expiresAt)
                        const isActing = sessionActionId === session.id
                        return (
                          <div
                            key={session.id}
                            className="rounded-lg border bg-background px-3 py-3 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">{session.label}</p>
                                  {session.isCurrent ? (
                                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                      Current
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  {session.deviceName ? <span>Device: {session.deviceName}</span> : null}
                                  {session.browser ? <span>Browser: {session.browser}</span> : null}
                                  {session.os ? <span>OS: {session.os}</span> : null}
                                  {session.ipAddress ? <span>IP: {session.ipAddress}</span> : null}
                                  {session.location ? <span>Location: {session.location}</span> : null}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                  {createdAt ? <span>Created: {createdAt}</span> : null}
                                  {lastUsedAt ? <span>Last used: {lastUsedAt}</span> : null}
                                  {expiresAt ? <span>Expires: {expiresAt}</span> : null}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant={session.isCurrent ? "destructive" : "outline"}
                                onClick={() => void handleRevokeSession(session.id, session.isCurrent)}
                                disabled={isActing || logoutAllBusy}
                              >
                                {isActing ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : session.isCurrent ? (
                                  <LogOut className="size-4" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                                {session.isCurrent ? "Sign out this device" : "Revoke session"}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full shrink-0 p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                    {securityLoading ? (
                      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : emailVerified ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <MailCheck className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {securityLoading
                          ? "Checking email status…"
                          : emailVerified
                            ? "Email is verified"
                            : "Email is not verified"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emailVerified
                          ? "Your email can be used for recovery and security alerts."
                          : "Verify your email so account recovery and security alerts can reach you."}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                    {accountEmail
                      ? `Verification email address: ${accountEmail}`
                      : "We will use the email address attached to your account for verification and recovery."}
                  </div>
                  {!emailVerified ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Request a fresh verification link if you still have not confirmed your email.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={emailBusy || !accountEmail}
                        >
                          {emailBusy ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
                          Resend verification
                        </Button>
                        <Link
                          href={ROUTES.verifyEmail}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          Open verification page
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-700 dark:text-emerald-300">
                      Email verification is complete. Recovery and security notifications can be sent to this address.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Notification Preferences</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose which channels should alert you for leave, onboarding, offboarding, attendance, and system events.
            </p>
            <p className="text-xs text-muted-foreground">
              Rows marked as default still follow the backend default until you change them here.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadNotificationPreferences()}
            disabled={notificationPreferencesLoading || !token}
          >
            {notificationPreferencesLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationPreferencesError ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {notificationPreferencesError}
            </div>
          ) : null}

          {notificationPreferencesLoading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading notification preferences...
            </div>
          ) : (
            <div className="space-y-4">
              {NOTIFICATION_PREFERENCE_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                    <span className="text-[11px] text-muted-foreground">
                      {group.types.length} type{group.types.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Notification
                          </th>
                          {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => (
                            <th
                              key={channel}
                              className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {formatNotificationPreferenceLabel(channel)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.types.map((notificationType) => (
                          <tr key={notificationType} className="border-t">
                            <td className="px-3 py-3 align-top">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-foreground">
                                  {formatNotificationPreferenceLabel(notificationType)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {notificationType}
                                </p>
                              </div>
                            </td>
                            {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => {
                              const key = buildNotificationPreferenceKey(notificationType, channel)
                              const preference = notificationPreferencesByKey.get(key) ?? null
                              const busy = notificationPreferenceBusyKey === key
                              const hasExplicitPreference = Boolean(preference)
                              return (
                                <td key={channel} className="px-3 py-3 text-center align-middle">
                                  <div className="flex flex-col items-center gap-1">
                                    <Switch
                                      checked={readNotificationPreferenceEnabled(preference)}
                                      disabled={busy || !token}
                                      aria-label={`${formatNotificationPreferenceLabel(notificationType)} ${formatNotificationPreferenceLabel(channel)}`}
                                      onCheckedChange={(checked) =>
                                        void handleToggleNotificationPreference(
                                          notificationType,
                                          channel,
                                          Boolean(checked)
                                        )
                                      }
                                    />
                                    <span className="text-[10px] text-muted-foreground">
                                      {busy
                                        ? "Saving..."
                                        : hasExplicitPreference
                                          ? readNotificationPreferenceEnabled(preference)
                                            ? "On"
                                            : "Off"
                                          : "Default"}
                                    </span>
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function AccountSettingsPanel(props: AccountSettingsPanelProps) {
  return (
    <React.Suspense fallback={<AccountSettingsPanelLoadingFallback />}>
      <AccountSettingsPanelContent {...props} />
    </React.Suspense>
  )
}
