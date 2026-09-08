"use client"

import * as React from "react"
import { BadgeCheck } from "@/components/animate-ui/icons/badge-check"
import { X } from "lucide-react"
import { SUCCESS_ALERT_EVENT } from "@/lib/success-alert"

type SuccessDetail = {
  title?: string
  message?: string
}

export function SuccessAlertOverlay() {
  const [open, setOpen] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const [exiting, setExiting] = React.useState(false)
  const [title, setTitle] = React.useState("Done")
  const [message, setMessage] = React.useState("")

  const dismiss = React.useCallback(() => {
    setExiting(true)
    setVisible(false)
    setTimeout(() => {
      setOpen(false)
      setExiting(false)
    }, 180)
  }, [])

  React.useEffect(() => {
    const onSuccess = (event: Event) => {
      const custom = event as CustomEvent<SuccessDetail>
      setTitle(custom.detail?.title || "Done")
      setMessage(custom.detail?.message || "Completed successfully.")
      setOpen(true)
      setExiting(false)
      setVisible(false)
      window.setTimeout(() => setVisible(true), 12)
    }

    window.addEventListener(SUCCESS_ALERT_EVENT, onSuccess as EventListener)
    return () => {
      window.removeEventListener(SUCCESS_ALERT_EVENT, onSuccess as EventListener)
    }
  }, [])

  if (!open) {
    return null
  }

  const animClass = exiting
    ? "toast-slide-out opacity-0"
    : visible
      ? "toast-slide-in"
      : "opacity-0 translate-x-6"

  return (
    <div
      className={`fixed top-4 right-4 z-[200] w-[min(26rem,calc(100vw-2rem))] pointer-events-auto ${animClass}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#303194]/25 bg-white shadow-lg dark:bg-card">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-[#303194]" />

        <div className="flex items-start gap-3 p-3.5 pr-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#303194]/10">
            <BadgeCheck size={16} className="text-[#303194]" />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[13px] font-semibold tracking-[-0.1px] text-foreground">{title}</div>
            <div className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-muted-foreground">
              {message}
            </div>
          </div>

          <button
            onClick={dismiss}
            aria-label="Close"
            className="ml-1 mt-0.5 rounded p-1 text-muted-foreground/70 transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
