"use client"

import * as React from "react"
import { adminRequest } from "@/lib/admin-api"
import { getSessionSnapshot, getServerSessionSnapshot, subscribeSession } from "@/lib/auth-session-store"
import { toast } from "@/components/ui/fluent-toast-store"

type Appearance = { theme?: "light" | "dark" | "system"; accent?: string; employeeBackground?: "aurora" | "geometric" | "glow" | "plain" | "original"; managerBackground?: "aurora" | "geometric" | "glow" }

function readCache(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeCache(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* Account storage still works. */ }
}

/** Server preferences are authoritative; the cache is scoped to the signed-in user. */
export function useAccountAppearance<K extends keyof Appearance>(
  field: K,
  fallback: NonNullable<Appearance[K]>,
  apply: (value: NonNullable<Appearance[K]>) => void,
) {
  const session = React.useSyncExternalStore(subscribeSession, getSessionSnapshot, getServerSessionSnapshot)
  const token = session.tokens?.accessToken
  const subject = session.subject
  const applyRef = React.useRef(apply)
  const revision = React.useRef(0)
  const queue = React.useRef<Promise<unknown>>(Promise.resolve())
  React.useEffect(() => { applyRef.current = apply }, [apply])

  React.useEffect(() => {
    if (!token || !subject) return
    let cancelled = false
    const cacheKey = `hrms.appearance:${subject}:${field}`
    const valid = (value: unknown): value is NonNullable<Appearance[K]> =>
      typeof value === "string" && (field === "theme"
        ? ["light", "dark", "system"].includes(value)
        : field === "accent" ? /^#[0-9a-fA-F]{6}$/.test(value)
        : (field === "managerBackground" ? ["aurora", "geometric", "glow"] : ["aurora", "geometric", "glow", "plain", "original"]).includes(value))
    const cached = readCache(cacheKey)
    applyRef.current(valid(cached) ? cached : fallback)
    const refresh = async () => {
      const started = revision.current
      try {
        await queue.current
        const preferences = await adminRequest<Appearance>("/api/users/me/appearance", { token })
        if (cancelled || started !== revision.current) return
        const value = preferences[field]
        const next = valid(value) ? value : fallback
        applyRef.current(next)
        writeCache(cacheKey, next)
      } catch {
        if (!cancelled) toast.error("Could not load your saved appearance. Reconnect and return to this window to retry.")
      }
    }
    void refresh()
    window.addEventListener("focus", refresh)
    return () => { cancelled = true; window.removeEventListener("focus", refresh) }
  }, [token, subject, field, fallback])

  return React.useCallback((value: NonNullable<Appearance[K]>) => {
    revision.current += 1
    applyRef.current(value)
    if (!token || !subject) return
    const cacheKey = `hrms.appearance:${subject}:${field}`
    writeCache(cacheKey, value)
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        await adminRequest<Appearance>("/api/users/me/appearance", { token, method: "PATCH", body: { [field]: value } })
      } catch {
        toast.error("Appearance changed on this device, but could not be saved to your account. Please choose it again when connected.")
      }
    })
  }, [token, subject, field])
}
