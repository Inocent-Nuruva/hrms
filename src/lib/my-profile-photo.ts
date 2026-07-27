"use client"

import * as React from "react"

import { getMyProfilePhotoUrl } from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"

type Listener = () => void

/** `undefined` = not loaded yet; `null` = loaded, no photo; string = URL. */
let cachedUrl: string | null | undefined = undefined
let cachedToken = ""
let inflight: Promise<string | null> | null = null
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function getCachedMyProfilePhotoUrl(): string | null {
  return cachedUrl === undefined ? null : cachedUrl
}

export function hasLoadedMyProfilePhoto(): boolean {
  return cachedUrl !== undefined
}

export function setMyProfilePhotoUrl(url: string | null) {
  cachedUrl = typeof url === "string" && url.trim() ? url.trim() : null
  emit()
}

export function invalidateMyProfilePhoto() {
  cachedUrl = undefined
  inflight = null
  emit()
}

export function subscribeMyProfilePhoto(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Load (or re-load) the signed-in user's profile photo URL from
 * GET /api/me/profile/photo. Concurrent callers share one in-flight request.
 */
export async function ensureMyProfilePhotoUrl(
  token?: string | null,
  options: { force?: boolean } = {}
): Promise<string | null> {
  const resolvedToken = (token ?? readStoredSessionTokens().accessToken).trim()
  if (!resolvedToken) {
    cachedUrl = null
    cachedToken = ""
    emit()
    return null
  }

  const force = options.force === true
  if (!force && cachedToken === resolvedToken && cachedUrl !== undefined && !inflight) {
    return cachedUrl
  }

  if (!force && inflight && cachedToken === resolvedToken) {
    return inflight
  }

  cachedToken = resolvedToken
  inflight = getMyProfilePhotoUrl(resolvedToken)
    .then((url) => {
      cachedUrl = url
      emit()
      return url
    })
    .catch(() => {
      // Keep a previous good URL if a refresh fails mid-session.
      if (cachedUrl === undefined) {
        cachedUrl = null
        emit()
      }
      return cachedUrl ?? null
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

/**
 * Subscribe to the current user's profile photo URL (GET /api/me/profile/photo).
 * Prefer this over scraping profile_photo_url off user/employee records.
 */
export function useMyProfilePhoto(token?: string | null) {
  const [url, setUrl] = React.useState<string | null>(() => getCachedMyProfilePhotoUrl())
  const [loading, setLoading] = React.useState(() => !hasLoadedMyProfilePhoto())

  React.useEffect(() => {
    return subscribeMyProfilePhoto(() => {
      setUrl(getCachedMyProfilePhotoUrl())
      setLoading(!hasLoadedMyProfilePhoto() && Boolean(inflight))
    })
  }, [])

  React.useEffect(() => {
    const resolvedToken = (token ?? readStoredSessionTokens().accessToken).trim()
    if (!resolvedToken) {
      setUrl(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(!hasLoadedMyProfilePhoto() || cachedToken !== resolvedToken)
    void ensureMyProfilePhotoUrl(resolvedToken).then((next) => {
      if (!cancelled) {
        setUrl(next)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [token])

  const refresh = React.useCallback(async () => {
    const resolvedToken = (token ?? readStoredSessionTokens().accessToken).trim()
    if (!resolvedToken) {
      setUrl(null)
      return null
    }
    setLoading(true)
    const next = await ensureMyProfilePhotoUrl(resolvedToken, { force: true })
    setUrl(next)
    setLoading(false)
    return next
  }, [token])

  return { url, loading, refresh }
}
