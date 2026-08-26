"use client"

import * as React from "react"

import { clearStoredSession, persistSessionTokens, readJwtExpiry, readStoredSessionTokens, redirectToLogin } from "@/lib/session-client"
import {
  DASHBOARD_ACCESS_REFRESH_EVENT,
  DASHBOARD_PERMISSION_STORAGE_KEY,
  publishDashboardActorSnapshot,
  publishDashboardActorSnapshotFromBrowserStorage,
  publishDashboardActorSnapshotFromSources,
  readDashboardActorSnapshotFromBrowser,
} from "@/lib/dashboard-permissions"
import { authService } from "@/services/authService"
import { ApiError } from "@/services/api"
import { AUTH_STORAGE_KEYS, ROUTES } from "@/utils/constants"
import { env } from "@/lib/env"

const SESSION_CHECK_INTERVAL_MS = env.NEXT_PUBLIC_SESSION_CHECK_INTERVAL_MS
const ACCESS_TOKEN_REFRESH_WINDOW_MS = env.NEXT_PUBLIC_TOKEN_REFRESH_WINDOW_MS

function readStoredUserPasswordChangeRequirement() {
  if (typeof window === "undefined") {
    return false
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
    if (!raw) {
      return false
    }

    const parsed = JSON.parse(raw) as { requiresPasswordChange?: unknown }
    return parsed.requiresPasswordChange === true
  } catch {
    return false
  }
}

export function SessionExpiryGuard() {
  const refreshInFlightRef = React.useRef<Promise<void> | null>(null)
  const accessSyncInFlightRef = React.useRef<Promise<"ok" | "unauthorized" | "failed"> | null>(null)
  const lastAccessSyncAtRef = React.useRef(0)

  const expireSession = React.useCallback(() => {
    clearStoredSession()
    redirectToLogin()
  }, [])

  const isProtectedPath = React.useCallback((pathname: string) => {
    return pathname.startsWith(ROUTES.dashboard) || pathname.startsWith(ROUTES.onboarding)
  }, [])

  const syncAccessContext = React.useCallback(
    async (accessToken: string, force = false) => {
      if (
        !force &&
        Date.now() - lastAccessSyncAtRef.current < SESSION_CHECK_INTERVAL_MS
      ) {
        return "ok" as const
      }

      if (!accessSyncInFlightRef.current) {
        accessSyncInFlightRef.current = (async () => {
          try {
            const user = await authService.getCurrentUser(accessToken)
            window.localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user))
            // When /api/users/me explicitly includes access fields it replaces
            // every cached/JWT permission. Older API deployments that omit the
            // access context retain the current token as a compatibility fallback.
            publishDashboardActorSnapshotFromSources(
              user,
              ...(user.accessContextResolved ? [] : [accessToken]),
            )
            lastAccessSyncAtRef.current = Date.now()
            return "ok" as const
          } catch (errorObject) {
            if (errorObject instanceof ApiError && errorObject.statusCode === 401) {
              return "unauthorized" as const
            }
            // A temporary network outage must not make the authenticated shell
            // unusable. Prefer the last exact live snapshot; only older sessions
            // without one need the legacy browser/JWT compatibility fallback.
            if (window.sessionStorage.getItem(DASHBOARD_PERMISSION_STORAGE_KEY) !== null) {
              publishDashboardActorSnapshot(readDashboardActorSnapshotFromBrowser())
            } else {
              publishDashboardActorSnapshotFromBrowserStorage(accessToken)
            }
            return "failed" as const
          } finally {
            accessSyncInFlightRef.current = null
          }
        })()
      }

      return accessSyncInFlightRef.current
    },
    [],
  )

  const ensureFreshSession = React.useCallback(async (forceAccessSync = false) => {
    if (typeof window === "undefined") {
      return
    }

    const pathname = window.location.pathname

    if (pathname === ROUTES.login) {
      return
    }

    const requiresPasswordChange = readStoredUserPasswordChangeRequirement()
    if (
      requiresPasswordChange &&
      pathname !== ROUTES.changePassword &&
      isProtectedPath(pathname)
    ) {
      window.location.assign(`${ROUTES.changePassword}?required=1`)
      return
    }

    const { accessToken, refreshToken } = readStoredSessionTokens()
    if (!accessToken) {
      if (isProtectedPath(pathname)) {
        expireSession()
      }
      return
    }

    const accessExpiry = readJwtExpiry(accessToken)
    let activeAccessToken = accessToken

    if (
      accessExpiry !== null &&
      accessExpiry - Date.now() <= ACCESS_TOKEN_REFRESH_WINDOW_MS &&
      !refreshToken
    ) {
      expireSession()
      return
    }

    if (
      accessExpiry !== null &&
      accessExpiry - Date.now() <= ACCESS_TOKEN_REFRESH_WINDOW_MS &&
      refreshToken &&
      !refreshInFlightRef.current
    ) {
      refreshInFlightRef.current = (async () => {
        try {
          const response = await authService.refresh(refreshToken)
          const nextAccessToken = response.tokens.accessToken.trim()
          const nextRefreshToken = response.tokens.refreshToken.trim()

          if (!nextAccessToken || !nextRefreshToken) {
            expireSession()
            return
          }

          persistSessionTokens(nextAccessToken, nextRefreshToken)
          if (response.user) {
            window.localStorage.setItem(
              AUTH_STORAGE_KEYS.user,
              JSON.stringify(response.user)
            )
          }
          activeAccessToken = nextAccessToken
        } catch {
          expireSession()
        } finally {
          refreshInFlightRef.current = null
        }
      })()
    }

    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current
      activeAccessToken = readStoredSessionTokens().accessToken || activeAccessToken
    }

    const accessSyncResult = await syncAccessContext(activeAccessToken, forceAccessSync)
    if (accessSyncResult === "unauthorized") {
      expireSession()
    }
  }, [expireSession, isProtectedPath, syncAccessContext])

  React.useEffect(() => {
    void ensureFreshSession(true)

    const intervalId = window.setInterval(() => {
      void ensureFreshSession()
    }, SESSION_CHECK_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void ensureFreshSession(true)
      }
    }

    const handleFocus = () => {
      void ensureFreshSession(true)
    }

    const handleAccessRefreshRequest = () => {
      void ensureFreshSession(true)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)
    window.addEventListener(DASHBOARD_ACCESS_REFRESH_EVENT, handleAccessRefreshRequest)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener(DASHBOARD_ACCESS_REFRESH_EVENT, handleAccessRefreshRequest)
    }
  }, [ensureFreshSession])

  return null
}
