"use client"

import * as React from "react"
import { BadgeCheck } from "@/components/animate-ui/icons/badge-check"
import { SUCCESS_ALERT_EVENT } from "@/lib/success-alert"

type SuccessDetail = {
  title?: string
  message?: string
}

export function SuccessAlertOverlay() {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("Done")
  const [message, setMessage] = React.useState("")

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const onSuccess = (event: Event) => {
      const custom = event as CustomEvent<SuccessDetail>
      setTitle(custom.detail?.title || "Done")
      setMessage(custom.detail?.message || "Completed successfully.")
      setOpen(true)
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => setOpen(false), 1600)
    }

    window.addEventListener(SUCCESS_ALERT_EVENT, onSuccess as EventListener)
    return () => {
      window.removeEventListener(SUCCESS_ALERT_EVENT, onSuccess as EventListener)
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/20 backdrop-blur-md">
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3 text-center text-foreground">
          <BadgeCheck
            size={72}
            animation="path-loop"
            animate
            className="text-[var(--sidebar-active-link-color)] drop-shadow-[0_8px_18px_rgba(0,0,0,0.25)]"
          />
          <p className="text-xl font-semibold">{title}</p>
          <p className="max-w-lg text-sm text-foreground/85">{message}</p>
        </div>
      </div>
    </div>
  )
}
