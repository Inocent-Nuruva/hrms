"use client"

import * as React from "react"

import { clearStoredSession, persistSessionTokens, readJwtExpiry, readStoredSessionTokens, redirectToLogin } from "@/lib/session-client"
import { publishDashboardActorSnapshotFromBrowserStorage } from "@/lib/dashboard-permissions"
import { authService } from "@/services/authService"
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

  const expireSession = React.useCallback(() => {
    clearStoredSession()
    redirectToLogin()
  }, [])

  const isProtectedPath = React.useCallback((pathname: string) => {
    return pathname.startsWith(ROUTES.dashboard) || pathname.startsWith(ROUTES.onboarding)
  }, [])

  const ensureFreshSession = React.useCallback(async () => {
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

    publishDashboardActorSnapshotFromBrowserStorage(accessToken)

    const accessExpiry = readJwtExpiry(accessToken)
    if (accessExpiry === null || accessExpiry - Date.now() > ACCESS_TOKEN_REFRESH_WINDOW_MS) {
      return
    }

    if (!refreshToken) {
      expireSession()
      return
    }

    if (!refreshInFlightRef.current) {
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
          publishDashboardActorSnapshotFromBrowserStorage(response.user ?? nextAccessToken)
        } catch {
          expireSession()
        } finally {
          refreshInFlightRef.current = null
        }
      })()
    }

    await refreshInFlightRef.current
  }, [expireSession, isProtectedPath])

  React.useEffect(() => {
    void ensureFreshSession()

    const intervalId = window.setInterval(() => {
      void ensureFreshSession()
    }, SESSION_CHECK_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void ensureFreshSession()
      }
    }

    const handleFocus = () => {
      void ensureFreshSession()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [ensureFreshSession])

  return null
}
