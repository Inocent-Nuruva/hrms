"use client"

import { AUTH_STORAGE_KEYS, ROUTES } from "@/utils/constants"
import {
  clearDashboardActorSnapshot,
  persistDashboardAccessToken,
} from "@/lib/dashboard-permissions"

const ACCESS_TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const LEGACY_SESSION_TOKEN_KEY = "ess_auth_token"

export const SESSION_CLEARED_EVENT = "hrms:session-cleared"

type StoredTokens = {
  accessToken: string
  refreshToken: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
}

function readString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return ""
  }

  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

export function readStoredSessionTokens(): StoredTokens {
  if (typeof window === "undefined") {
    return { accessToken: "", refreshToken: "" }
  }

  const directToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim() ?? ""
  const legacyToken = window.sessionStorage.getItem(LEGACY_SESSION_TOKEN_KEY)?.trim() ?? ""
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)

  let accessToken = directToken
  let refreshToken = ""

  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as unknown
      const root = asRecord(parsed)
      const rootTokens = asRecord(root?.tokens)
      const rootData = asRecord(root?.data)
      const rootDataTokens = asRecord(rootData?.tokens)
      const candidates = [root, rootTokens, rootData, rootDataTokens]

      for (const candidate of candidates) {
        const candidateAccess = readString(candidate, ["accessToken", "access_token", "token"])
        const candidateRefresh = readString(candidate, ["refreshToken", "refresh_token"])

        if (candidateAccess && !accessToken) {
          accessToken = candidateAccess
        }
        if (candidateRefresh && !refreshToken) {
          refreshToken = candidateRefresh
        }
      }
    } catch {
      accessToken = accessToken || authTokensRaw.trim()
    }
  }

  if (!accessToken && legacyToken) {
    accessToken = legacyToken
  }

  return { accessToken, refreshToken }
}

export function persistSessionTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken)
  window.localStorage.setItem(
    AUTH_STORAGE_KEYS.tokens,
    JSON.stringify({
      accessToken,
      refreshToken,
    })
  )
  persistDashboardAccessToken(accessToken)
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.tokens)
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.user)
  window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY)
  clearDashboardActorSnapshot()
  void import("@/lib/forbidden-routes").then((mod) => {
    mod.clearDashboardRouteMemory()
  })
  // The photo store listens for this. Importing it here would pull the full
  // admin API client into every page that clears a session, including login.
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT))
}

export function readJwtExpiry(token: string) {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) {
    return null
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const payload = JSON.parse(window.atob(padded)) as { exp?: unknown }
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function redirectToLogin() {
  if (typeof window === "undefined") {
    return
  }

  if (window.location.pathname !== ROUTES.login) {
    window.location.assign(ROUTES.login)
  }
}
