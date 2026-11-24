"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  CheckCircle2, Copy, ImageIcon, InfoIcon, KeyRound, LogOut, MailCheck, RefreshCw, ShieldCheck, ShieldOff, Smartphone, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"
import {
  Switch,
  Tab,
  TabList,
  type SelectTabData,
} from "@fluentui/react-components"
import {
  extractDefaultAvatarImageUrl,
  extractBackupCodes,
  extractProfilePhotoUrl,
  listSelectableAvatarsForMe,
  listMyNotificationPreferences,
  readDefaultAvatarId,
  selectMyUserAvatar,
  setMyNotificationPreference,
  uploadMyProfilePhoto,
  type AdminRecord,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationPreferenceType,
} from "@/lib/admin-api"
import { setMyProfilePhotoUrl } from "@/lib/my-profile-photo"
import { clearStoredSession, persistSessionUser, readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { useFluentToastState } from "@/components/ui/use-fluent-toast-state"
import { AuthenticationSettings } from "./authentication-settings"
import { getSessionSnapshot } from "@/lib/auth-session-store"
import { authService } from "@/services/authService"
import type { AuthSessionRecord, TwoFactorSetupResponse } from "@/types"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  canAccessDashboardRoute,
  hasPermission,
  publishDashboardActorSnapshotFromBrowserStorage,
} from "@/lib/dashboard-permissions"
import {
  AUTH_STORAGE_KEYS,
  ROUTES,
  SETTINGS_SECURITY_TABS,
  buildDashboardResetPasswordHref,
} from "@/utils/constants"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AccountSettingsPanelProps {
  token: string
  loading: boolean
  onChangeMyPassword: (oldPassword: string, newPassword: string) => Promise<void>
  profilePhotoUrl?: string | null
  displayName?: string | null
  profilePictureHref?: string | null
}

type SecurityTab = "reset-password" | "two-factor" | "devices" | "email"
type SettingsSection = "profile" | "security" | "notifications"

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
      "ONBOARDING_CANCELLED",
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
    types: ["ATTENDANCE_LATE", "ATTENDANCE_MISSING", "ATTENDANCE_CORRECTION"],
  },
  {
    title: "KPI & Performance",
    types: ["KPI_PERIOD_CREATED", "KPI_ASSIGNED"],
  },
]

function securityTabFromQuery(value: string | null): SecurityTab {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "two-factor" || normalized === "2fa" || normalized === "mfa") return "two-factor"
  if (normalized === "devices" || normalized === "device") return "devices"
  if (normalized === "email" || normalized === "verify-email" || normalized === "verify") return "email"
  if (normalized === "password" || normalized === SETTINGS_SECURITY_TABS.resetPassword) {
    return SETTINGS_SECURITY_TABS.resetPassword
  }
  return SETTINGS_SECURITY_TABS.resetPassword
}

function persistCurrentUserSnapshot(user: unknown, accessToken: string) {
  if (typeof window === "undefined" || !user || typeof user !== "object") {
    return false
  }

  try {
    persistSessionUser(user)
    publishDashboardActorSnapshotFromBrowserStorage(user, accessToken)
    return true
  } catch {
    return false
  }
}

function clearStoredPasswordChangeRequirement(accessToken: string) {
  if (typeof window === "undefined") {
    return
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
    if (!raw) {
      return
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return
    }

    const nextUser = {
      ...parsed,
      requiresPasswordChange: false,
    }
    persistCurrentUserSnapshot(nextUser, accessToken)
  } catch {
    // Ignore malformed local cache and rely on the next sync.
  }
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
  // The backend treats a missing row as enabled. Reflect that default in the
  // UI instead of making new accounts look opted out of every channel.
  if (!preference) return true
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
  const settingsSection = (() => {
    const section = searchParams?.get("section")?.toLowerCase()
    if (section === "security" || section === "notifications") return section
    return "profile"
  })() satisfies SettingsSection
  const [requiresPasswordChange, setRequiresPasswordChange] = React.useState(false)
  const [passwordBusy, setPasswordBusy] = React.useState(false)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

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
  const [sessionPolicy, setSessionPolicy] = React.useState<Awaited<ReturnType<typeof authService.getSessionPolicy>> | null>(null)
  const [sessionsLoading, setSessionsLoading] = React.useState(false)
  const [sessionActionId, setSessionActionId] = React.useState<string | null>(null)
  const [sessionMessage, setSessionMessage] = React.useState<string | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)

  useFluentToastState(sessionMessage, setSessionMessage, "success")
  const [logoutAllBusy, setLogoutAllBusy] = React.useState(false)
  const [notificationPreferences, setNotificationPreferences] = React.useState<NotificationPreference[]>([])
  const [notificationPreferencesLoading, setNotificationPreferencesLoading] = React.useState(false)
  const [notificationPreferencesError, setNotificationPreferencesError] = React.useState<string | null>(null)
  const [notificationPreferenceBusyKey, setNotificationPreferenceBusyKey] = React.useState<string | null>(null)
  const [notificationSearch, setNotificationSearch] = React.useState("")
  const [profilePictureOpen, setProfilePictureOpen] = React.useState(false)
  const [profilePictureSaving, setProfilePictureSaving] = React.useState(false)
  const [profilePictureError, setProfilePictureError] = React.useState<string | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = React.useState("")
  const [profilePictureFile, setProfilePictureFile] = React.useState<File | null>(null)
  const [profilePictureFileName, setProfilePictureFileName] = React.useState("")
  const [defaultAvatars, setDefaultAvatars] = React.useState<AdminRecord[]>([])
  const [defaultAvatarsLoading, setDefaultAvatarsLoading] = React.useState(false)
  const [selectedDefaultAvatarId, setSelectedDefaultAvatarId] = React.useState<number | null>(null)
  const profilePictureInputRef = React.useRef<HTMLInputElement | null>(null)
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

  React.useEffect(() => {
    if (!profilePictureOpen) return
    const accessToken = resolveFreshAccessToken(token)
    setProfilePictureError(null)
    setProfilePicturePreview(profilePhotoUrl ?? "")
    setProfilePictureFile(null)
    setProfilePictureFileName("")
    setSelectedDefaultAvatarId(null)
    if (!accessToken) return

    let cancelled = false
    setDefaultAvatarsLoading(true)
    void listSelectableAvatarsForMe(accessToken)
      .then((rows) => {
        if (!cancelled) setDefaultAvatars(rows)
      })
      .catch(() => {
        if (!cancelled) setDefaultAvatars([])
      })
      .finally(() => {
        if (!cancelled) setDefaultAvatarsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profilePictureOpen, profilePhotoUrl, token])

  const handleProfilePictureFile = React.useCallback((file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setProfilePictureError("Please choose a PNG, JPG, or WEBP image.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfilePictureError("Please choose an image smaller than 5 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const preview = typeof reader.result === "string" ? reader.result : ""
      if (!preview) {
        setProfilePictureError("We couldn't read that image. Please choose another file.")
        return
      }
      setProfilePictureError(null)
      setProfilePictureFile(file)
      setProfilePictureFileName(file.name)
      setSelectedDefaultAvatarId(null)
      setProfilePicturePreview(preview)
    }
    reader.onerror = () => setProfilePictureError("We couldn't read that image. Please choose another file.")
    reader.readAsDataURL(file)
  }, [])

  const saveProfilePicture = React.useCallback(async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      setProfilePictureError("Session expired. Please sign in again.")
      return
    }
    if (!profilePictureFile && selectedDefaultAvatarId == null) {
      setProfilePictureError("Choose a default avatar or upload an image first.")
      return
    }

    setProfilePictureSaving(true)
    setProfilePictureError(null)
    try {
      const result = profilePictureFile
        ? await uploadMyProfilePhoto(accessToken, profilePictureFile)
        : await selectMyUserAvatar(accessToken, selectedDefaultAvatarId!)
      const savedUrl = extractProfilePhotoUrl(result) || profilePicturePreview
      if (savedUrl) setMyProfilePhotoUrl(savedUrl)
      toast.success(profilePictureFile ? "Profile picture updated." : "Default avatar applied.")
      setProfilePictureOpen(false)
    } catch (errorObject) {
      setProfilePictureError(
        errorObject instanceof Error ? errorObject.message : "Could not update your profile picture."
      )
    } finally {
      setProfilePictureSaving(false)
    }
  }, [profilePictureFile, profilePicturePreview, selectedDefaultAvatarId, token])

  React.useEffect(() => {
    if (!hasHydrated) {
      return
    }

    setRequiresPasswordChange(searchParams?.get("required") === "1")
  }, [hasHydrated, searchParams])

  const handleTabChange = React.useCallback(
    (tab: SecurityTab) => {
      if (requiresPasswordChange && tab !== SETTINGS_SECURITY_TABS.resetPassword) {
        router.replace(buildDashboardResetPasswordHref({ required: true }), { scroll: false })
        return
      }
      const nextHref = buildSettingsTabHref(pathname, searchParams, tab)
      router.replace(nextHref, { scroll: false })
    },
    [pathname, requiresPasswordChange, router, searchParams]
  )

  const handleSectionChange = React.useCallback(
    (section: SettingsSection) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set("section", section)
      router.replace(`${pathname ?? "/dashboard/settings"}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )
  const handleSectionTabSelect = React.useCallback(
    (_event: unknown, data: SelectTabData) => {
      const section = String(data.value) as SettingsSection
      if (section === "profile" || section === "security" || section === "notifications") {
        handleSectionChange(section)
      }
    },
    [handleSectionChange],
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
    void authService.getSessionPolicy(accessToken).then(setSessionPolicy).catch(() => setSessionPolicy(null))
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
  const visibleNotificationGroups = React.useMemo(() => {
    const query = notificationSearch.trim().toLowerCase()
    if (!query) return NOTIFICATION_PREFERENCE_GROUPS
    return NOTIFICATION_PREFERENCE_GROUPS.map((group) => ({
      ...group,
      types: group.types.filter((type) =>
        `${group.title} ${type} ${formatNotificationPreferenceLabel(type)}`.toLowerCase().includes(query),
      ),
    })).filter((group) => group.types.length > 0)
  }, [notificationSearch])

  const handleChangePassword = async ({
    currentPassword,
    newPassword,
  }: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      const message = "Your session expired. Please sign in again."
      setPasswordError(message)
      toast.error(message)
      return
    }

    setPasswordBusy(true)
    setPasswordError(null)
    try {
      await onChangeMyPassword(currentPassword, newPassword)
      const mustSignInAgain = requiresPasswordChange || searchParams?.get("required") === "1"
      if (mustSignInAgain) {
        clearStoredSession()
        window.location.assign(ROUTES.login)
        return
      }
      const currentUser = await authService.getCurrentUser(accessToken).catch(() => null)
      if (!persistCurrentUserSnapshot(currentUser, accessToken)) {
        clearStoredPasswordChangeRequirement(accessToken)
      }
      setRequiresPasswordChange(false)
      showSuccessAlert(
        searchParams?.get("required") === "1"
          ? "Password updated. You can continue in HRMS."
          : "Password changed.",
      )
      void refreshSecurityFlags()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Password change failed."
      setPasswordError(message)
      toast.error(message)
    } finally {
      setPasswordBusy(false)
    }
  }

  const handleUseDifferentAccount = React.useCallback(() => {
    clearStoredSession()
    window.location.assign(ROUTES.login)
  }, [])

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
      <nav className="sticky top-0 z-20 -mx-4 min-w-0 border-b border-border/80 bg-card px-4 py-1 lg:-mx-6 lg:px-6" aria-label="Settings sections">
        <div className="tab-rail-scroll min-w-0">
          <TabList
            aria-label="Settings pages"
            size="small"
            selectedValue={settingsSection}
            onTabSelect={handleSectionTabSelect}
          >
            <Tab value="profile">Profile</Tab>
            <Tab value="security">Security</Tab>
            <Tab value="notifications">Notifications</Tab>
          </TabList>
        </div>
      </nav>
      {settingsSection === "profile" ? (
        <>
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
            <Button
              type="button"
              variant="outline"
              className="self-start sm:self-auto"
              onClick={() => setProfilePictureOpen(true)}
            >
              <ImageIcon className="size-4" />
              Change Profile Picture
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Dialog open={profilePictureOpen} onOpenChange={setProfilePictureOpen}>
        <DialogPopup from="bottom" className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Profile Picture</DialogTitle>
            <DialogDescription>
              Pick a default avatar or upload your own image. The saved picture updates across the dashboard and account menu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
              <Avatar className="size-16 ring-2 ring-background shadow-sm" size="lg">
                {profilePicturePreview ? (
                  <AvatarImage src={profilePicturePreview} alt="Selected profile picture" />
                ) : null}
                <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {profilePictureFileName || "Current profile picture"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  PNG, JPG, or WEBP up to 5 MB. Administrator uploads apply immediately.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Default avatars</Label>
                {defaultAvatarsLoading ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <FluentLoadingIndicator className="size-3 animate-spin" /> Loading
                  </span>
                ) : null}
              </div>
              {!defaultAvatarsLoading && defaultAvatars.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                  No default avatars are available yet. You can upload your own image below.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {defaultAvatars.map((avatar) => {
                    const id = readDefaultAvatarId(avatar)
                    const imageUrl = extractDefaultAvatarImageUrl(avatar)
                    if (id == null || !imageUrl) return null
                    const selected = selectedDefaultAvatarId === Number(id)
                    return (
                      <button
                        key={String(id)}
                        type="button"
                        className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${selected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-primary/30"}`}
                        onClick={() => {
                          setSelectedDefaultAvatarId(Number(id))
                          setProfilePictureFile(null)
                          setProfilePictureFileName(
                            typeof avatar.avatar_name === "string" ? avatar.avatar_name : "Default avatar"
                          )
                          setProfilePicturePreview(imageUrl)
                          setProfilePictureError(null)
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt="Default avatar" className="size-full object-cover" />
                        {selected ? (
                          <span className="absolute bottom-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <CheckCircle2 className="size-3.5" />
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-profile-picture">Upload your own image</Label>
              <input
                ref={profilePictureInputRef}
                id="account-profile-picture"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => handleProfilePictureFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => profilePictureInputRef.current?.click()}
              >
                <ImageIcon className="size-4" /> Choose image
              </Button>
            </div>

            {profilePictureError ? (
              <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {profilePictureError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProfilePictureOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveProfilePicture()} disabled={profilePictureSaving}>
              {profilePictureSaving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null}
              Save picture
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
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
        </>
      ) : null}
      {settingsSection === "security" ? (
      <Card>
        <CardHeader>
          <CardTitle>Security & Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-1 sm:grid-cols-4">
            <Button
              type="button"
              variant="ghost"
              aria-pressed={activeTab === "reset-password"}
              className={`justify-center gap-2 border px-2 text-xs transition-colors sm:text-sm ${
                activeTab === "reset-password"
                  ? "border-blue-500/40 bg-blue-500/15 text-blue-700 shadow-sm hover:bg-blue-500/20 dark:text-blue-300"
                  : "border-transparent"
              }`}
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
              aria-pressed={activeTab === "two-factor"}
              className={`justify-center gap-2 border px-2 text-xs transition-colors sm:text-sm ${
                activeTab === "two-factor"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 shadow-sm hover:bg-emerald-500/20 dark:text-emerald-300"
                  : "border-transparent"
              }`}
              onClick={() => handleTabChange("two-factor")}
              disabled={requiresPasswordChange}
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
              aria-pressed={activeTab === "devices"}
              className={`justify-center gap-2 border px-2 text-xs transition-colors sm:text-sm ${
                activeTab === "devices"
                  ? "border-violet-500/40 bg-violet-500/15 text-violet-700 shadow-sm hover:bg-violet-500/20 dark:text-violet-300"
                  : "border-transparent"
              }`}
              onClick={() => handleTabChange("devices")}
              disabled={requiresPasswordChange}
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
              aria-pressed={activeTab === "email"}
              className={`justify-center gap-2 border px-2 text-xs transition-colors sm:text-sm ${
                activeTab === "email"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-800 shadow-sm hover:bg-amber-500/20 dark:text-amber-300"
                  : "border-transparent"
              }`}
              onClick={() => handleTabChange("email")}
              disabled={requiresPasswordChange}
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

          {requiresPasswordChange ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              Finish updating your temporary password to unlock the rest of security settings.
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border">
            <div
              className="flex w-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${tabIndex * 100}%)` }}
            >
              <div className="w-full shrink-0 p-4">
                <ChangePasswordForm
                  onSubmit={handleChangePassword}
                  loading={passwordBusy || loading}
                  error={passwordError}
                  requiredMode={requiresPasswordChange}
                  onUseDifferentAccount={requiresPasswordChange ? handleUseDifferentAccount : undefined}
                />
              </div>

              <div className="w-full shrink-0 p-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                    {securityLoading ? (
                      <FluentLoadingIndicator className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
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
                            <FluentLoadingIndicator className="size-4 animate-spin" />
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
                                <FluentLoadingIndicator className="size-4 animate-spin" />
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
                              <FluentLoadingIndicator className="size-4 animate-spin" />
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
                            <FluentLoadingIndicator className="size-4 animate-spin" />
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
                        {sessionsLoading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Refresh
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleLogoutAllSessions}
                        disabled={logoutAllBusy || !token}
                      >
                        {logoutAllBusy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                        Sign out all
                      </Button>
                    </div>
                  </div>

                  {sessionError ? (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                      {sessionError}
                    </div>
                  ) : null}

                  {activeTab === "devices" && actor.ready && <AuthenticationSettings key={String(getSessionSnapshot().subject)+"-"+String(getSessionSnapshot().companyId)} token={token}
                    platform={actor.scope==="platform"} manage={hasPermission(actor.permissionLabels,"company_users:manage")}
                    audit={hasPermission(actor.permissionLabels,"security_events:read")} />}
                  {sessionPolicy ? (
                    <p className="text-xs text-muted-foreground">
                      Access token: {sessionPolicy.access}. Refresh token: {sessionPolicy.refresh}
                      {sessionPolicy.sliding ? " from its most recent renewal." : "."}
                      {sessionPolicy.maximumSeconds ? ` Maximum session lifetime: ${sessionPolicy.maximumSeconds / 3600} hours from sign-in.` : " No maximum session lifetime reported."}
                      {sessionPolicy.idleSeconds ? ` Inactivity timeout: ${sessionPolicy.idleSeconds/60} minutes.` : ""}
                      {sessionPolicy.maxSessions ? ` Device limit at sign-in: ${sessionPolicy.maxSessions}.` : ""}
                    </p>
                  ) : null}

                  {sessionsLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                      <FluentLoadingIndicator className="size-4 animate-spin" />
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
                                  {expiresAt ? <span>Refresh expires: {expiresAt}</span> : null}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant={session.isCurrent ? "destructive" : "outline"}
                                onClick={() => void handleRevokeSession(session.id, session.isCurrent)}
                                disabled={isActing || logoutAllBusy}
                              >
                                {isActing ? (
                                  <FluentLoadingIndicator className="size-4 animate-spin" />
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
                      <FluentLoadingIndicator className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
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
                          {emailBusy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
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

      ) : null}

      {settingsSection === "notifications" ? (
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle>Notification Preferences</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="About notification preferences"
                >
                  <InfoIcon className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-xs space-y-2 text-left">
                  <p>
                    Choose which channels should alert you for leave, onboarding, offboarding, attendance, and system events.
                  </p>
                  <p>
                    Rows marked “Default on” are enabled unless you turn them off or an administrator disables delivery system-wide.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadNotificationPreferences()}
            disabled={notificationPreferencesLoading || !token}
          >
            {notificationPreferencesLoading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Label htmlFor="notification-preference-search" className="sr-only">
              Search notification types
            </Label>
            <Input
              id="notification-preference-search"
              type="search"
              value={notificationSearch}
              onChange={(event) => setNotificationSearch(event.target.value)}
              placeholder="Search notification types"
            />
          </div>
          {notificationPreferencesError ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {notificationPreferencesError}
            </div>
          ) : null}

          {notificationPreferencesLoading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading notification preferences...
            </div>
          ) : (
            <div className="space-y-4">
              {visibleNotificationGroups.map((group) => (
                <div key={group.title} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                    <span className="text-[11px] text-muted-foreground">
                      {group.types.length} type{group.types.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <StandardTable className="min-w-full border-collapse text-sm">
                      <StandardTableHeader className="bg-muted/30">
                        <StandardTableRow>
                          <StandardTableHead className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Notification
                          </StandardTableHead>
                          {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => (
                            <StandardTableHead
                              key={channel}
                              className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {formatNotificationPreferenceLabel(channel)}
                            </StandardTableHead>
                          ))}
                        </StandardTableRow>
                      </StandardTableHeader>
                      <StandardTableBody>
                        {group.types.map((notificationType) => (
                          <StandardTableRow key={notificationType} className="border-t">
                            <StandardTableCell className="px-3 py-3 align-top">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-foreground">
                                  {formatNotificationPreferenceLabel(notificationType)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {notificationType}
                                </p>
                              </div>
                            </StandardTableCell>
                            {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => {
                              const key = buildNotificationPreferenceKey(notificationType, channel)
                              const preference = notificationPreferencesByKey.get(key) ?? null
                              const busy = notificationPreferenceBusyKey === key
                              const hasExplicitPreference = Boolean(preference)
                              const hasSelectedKpiChannel = NOTIFICATION_PREFERENCE_CHANNELS.some((candidate) => {
                                const selected = notificationPreferencesByKey.get(buildNotificationPreferenceKey(notificationType, candidate))
                                return selected && readNotificationPreferenceEnabled(selected)
                              })
                              const defaultEnabled = notificationType !== "KPI_PERIOD_CREATED" || (channel === "IN_APP" && !hasSelectedKpiChannel)
                              const isEnabled = hasExplicitPreference
                                ? readNotificationPreferenceEnabled(preference)
                                : defaultEnabled
                              return (
                                <StandardTableCell key={channel} className="px-3 py-3 text-center align-middle">
                                  <div className="flex justify-center">
                                    <Switch
                                      className="notification-preference-switch"
                                      size="medium"
                                      checked={isEnabled}
                                      disabled={busy || !token}
                                      aria-label={`${formatNotificationPreferenceLabel(notificationType)} ${formatNotificationPreferenceLabel(channel)}`}
                                      label={
                                        busy
                                          ? "Saving..."
                                          : hasExplicitPreference
                                            ? isEnabled
                                              ? "On"
                                              : "Off"
                                            : defaultEnabled ? "Default on" : "Default off"
                                      }
                                      labelPosition="after"
                                      onChange={(_event, data) =>
                                        void handleToggleNotificationPreference(
                                          notificationType,
                                          channel,
                                          data.checked
                                        )
                                      }
                                    />
                                  </div>
                                </StandardTableCell>
                              )
                            })}
                          </StandardTableRow>
                        ))}
                      </StandardTableBody>
                    </StandardTable>
                  </div>
                </div>
              ))}
              {visibleNotificationGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  No notification types match “{notificationSearch}”.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}
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
