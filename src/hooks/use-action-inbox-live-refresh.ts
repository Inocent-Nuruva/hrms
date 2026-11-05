"use client"

import * as React from "react"
import { ACTION_INBOX_CHANGED } from "@/lib/employee-lifecycle-events"
import { useNotifications } from "@/lib/notifications-store"

export function useActionInboxLiveRefresh(refresh: () => Promise<void>, busy: boolean) {
  useNotifications() // Reuse the authenticated connection; never open a second socket.
  const latest = React.useRef({ refresh, busy })
  React.useEffect(() => { latest.current = { refresh, busy } }, [refresh, busy])
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    let running = false
    let pending = false
    const run = async () => {
      if (disposed) return
      if (running || latest.current.busy || document.visibilityState === "hidden") return
      pending = false
      running = true
      try { await latest.current.refresh() } catch { /* The view displays load failures. */ }
      finally {
        running = false
        if (pending && !disposed) schedule()
      }
    }
    const schedule = () => {
      pending = true
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (latest.current.busy) schedule()
        else void run()
      }, 400)
    }
    const visible = () => { if (document.visibilityState === "visible") schedule() }
    window.addEventListener(ACTION_INBOX_CHANGED, schedule)
    window.addEventListener("focus", visible)
    document.addEventListener("visibilitychange", visible)
    return () => {
      disposed = true
      clearTimeout(timer)
      window.removeEventListener(ACTION_INBOX_CHANGED, schedule)
      window.removeEventListener("focus", visible)
      document.removeEventListener("visibilitychange", visible)
    }
  }, [])
}
