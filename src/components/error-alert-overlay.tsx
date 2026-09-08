"use client"

import * as React from "react"
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import { X } from "lucide-react"
import { ERROR_ALERT_EVENT } from "@/lib/error-alert"

type ErrorDetail = {
  title?: string
  message?: string
}

export function ErrorAlertOverlay() {
  const [open, setOpen] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const [exiting, setExiting] = React.useState(false)
  const [shake, setShake] = React.useState(false)
  const [title, setTitle] = React.useState("Something went wrong")
  const [message, setMessage] = React.useState("")

  const dismiss = React.useCallback(() => {
    setExiting(true)
    setVisible(false)
    setShake(false)
    setTimeout(() => {
      setOpen(false)
      setExiting(false)
    }, 180)
  }, [])

  React.useEffect(() => {
    const onError = (event: Event) => {
      const custom = event as CustomEvent<ErrorDetail>
      setTitle(custom.detail?.title || "Something went wrong")
      setMessage(custom.detail?.message || "Please try again.")
      setOpen(true)
      setExiting(false)
      setVisible(false)
      setShake(false)

      window.setTimeout(() => {
        setVisible(true)
        setShake(true)
        window.setTimeout(() => setShake(false), 520)
      }, 12)
    }

    window.addEventListener(ERROR_ALERT_EVENT, onError as EventListener)
    return () => {
      window.removeEventListener(ERROR_ALERT_EVENT, onError as EventListener)
    }
  }, [])

  if (!open) {
    return null
  }

  const animClass = exiting
    ? "toast-slide-out opacity-0"
    : visible
      ? `toast-slide-in ${shake ? "toast-error-shake" : ""}`
      : "opacity-0 translate-x-6"

  return (
    <div
      className={`fixed top-4 right-4 z-[200] w-[min(26rem,calc(100vw-2rem))] pointer-events-auto ${animClass}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-white shadow-lg dark:bg-card">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-red-500" />

        <div className="flex items-start gap-3 p-3.5 pr-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10">
            <CircleX size={16} className="text-red-500" />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[13px] font-semibold tracking-[-0.1px] text-red-600">{title}</div>
            <div className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-red-500/90">
              {message}
            </div>
          </div>

          <button
            onClick={dismiss}
            aria-label="Close"
            className="ml-1 mt-0.5 rounded p-1 text-red-400/70 transition hover:bg-red-500/5 hover:text-red-500 dark:hover:bg-white/10"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
