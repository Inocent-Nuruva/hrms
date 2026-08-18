"use client"

import * as React from "react"

import { readStoredSessionTokens } from "@/lib/session-client"

type Listener = () => void

/** `undefined` = not loaded yet; `null` = loaded, no photo; string = URL. */
let cachedUrl: string | null | undefined = undefined
let cachedToken = ""
/** Bumps whenever the photo URL is intentionally changed so UI can remount/bust cache. */
let photoRevision = 0
/** Monotonic generation — protects optimistic sets from stale GET overwrites. */
let photoGeneration = 0
/** While Date.now() < this, keep optimistic URL even if GET returns something older. */
let preferLocalUntil = 0
let inflight: Promise<string | null> | null = null
let inflightGeneration = 0
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function getCachedMyProfilePhotoUrl(): string | null {
  return cachedUrl === undefined ? null : cachedUrl
}

export function getMyProfilePhotoRevision(): number {
  return photoRevision
}

export function hasLoadedMyProfilePhoto(): boolean {
  return cachedUrl !== undefined
}

export function setMyProfilePhotoUrl(url: string | null) {
  const next = typeof url === "string" && url.trim() ? url.trim() : null
  // Always bump generation so in-flight GETs cannot clobber this value.
  photoGeneration += 1
  photoRevision += 1
  // Hold optimistic/local URL briefly so a lagging GET cannot roll the UI back.
  preferLocalUntil = Date.now() + 5_000
  cachedUrl = next
  emit()
}

export function invalidateMyProfilePhoto() {
  cachedUrl = undefined
  inflight = null
  photoGeneration += 1
  photoRevision += 1
  preferLocalUntil = 0
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
  // Capture generation at request start; ignore result if a newer setMyProfilePhotoUrl ran.
  const requestGeneration = photoGeneration
  inflightGeneration = requestGeneration
  inflight = import("@/lib/admin-api")
    .then((mod) => mod.getMyProfilePhotoUrl(resolvedToken))
    .then((url) => {
      if (requestGeneration !== photoGeneration) {
        // A newer optimistic/local URL was published while this GET was in flight.
        return cachedUrl ?? url
      }
      // Right after setMyProfilePhotoUrl, keep the local URL so the sidebar/header
      // do not snap back to a stale GET result.
      if (Date.now() < preferLocalUntil && cachedUrl) {
        return cachedUrl
      }
      // Prefer keeping a good cached URL if the server still returns empty right after upload.
      if (url == null && cachedUrl) {
        return cachedUrl
      }
      if (url !== cachedUrl) {
        photoRevision += 1
      }
      cachedUrl = url
      emit()
      return url
    })
    .catch(() => {
      // Keep a previous good URL if a refresh fails mid-session.
      if (cachedUrl === undefined && requestGeneration === photoGeneration) {
        cachedUrl = null
        emit()
      }
      return cachedUrl ?? null
    })
    .finally(() => {
      if (inflightGeneration === requestGeneration) {
        inflight = null
      }
    })

  return inflight
}

/**
 * Subscribe to the current user's profile photo URL (GET /api/me/profile/photo).
 * Prefer this over scraping profile_photo_url off user/employee records.
 */
export function useMyProfilePhoto(token?: string | null) {
  const [url, setUrl] = React.useState<string | null>(() => getCachedMyProfilePhotoUrl())
  const [revision, setRevision] = React.useState(() => getMyProfilePhotoRevision())
  const [loading, setLoading] = React.useState(() => !hasLoadedMyProfilePhoto())

  React.useEffect(() => {
    return subscribeMyProfilePhoto(() => {
      setUrl(getCachedMyProfilePhotoUrl())
      setRevision(getMyProfilePhotoRevision())
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
        setRevision(getMyProfilePhotoRevision())
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
    setRevision(getMyProfilePhotoRevision())
    setLoading(false)
    return next
  }, [token])

  return { url, loading, refresh, revision }
}
