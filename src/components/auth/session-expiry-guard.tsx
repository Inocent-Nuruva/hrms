"use client"

import * as React from "react"

import { clearStoredSession, persistSessionTokens, readJwtExpiry, readStoredSessionTokens, redirectToLogin } from "@/lib/session-client"
import { authService } from "@/services/authService"
import { ROUTES } from "@/utils/constants"

const SESSION_CHECK_INTERVAL_MS = 30_000
const ACCESS_TOKEN_REFRESH_WINDOW_MS = 60_000

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

    const { accessToken, refreshToken } = readStoredSessionTokens()
    if (!accessToken) {
      if (isProtectedPath(pathname)) {
        expireSession()
      }
      return
    }

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
