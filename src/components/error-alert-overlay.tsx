"use client"

import * as React from "react"
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import { ERROR_ALERT_EVENT } from "@/lib/error-alert"

type ErrorDetail = {
  title?: string
  message?: string
}

export function ErrorAlertOverlay() {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("Something went wrong")
  const [message, setMessage] = React.useState("")

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const onError = (event: Event) => {
      const custom = event as CustomEvent<ErrorDetail>
      setTitle(custom.detail?.title || "Something went wrong")
      setMessage(custom.detail?.message || "Please try again.")
      setOpen(true)
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => setOpen(false), 2200)
    }

    window.addEventListener(ERROR_ALERT_EVENT, onError as EventListener)
    return () => {
      window.removeEventListener(ERROR_ALERT_EVENT, onError as EventListener)
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-md">
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <CircleX
            size={72}
            animation="path-loop"
            animate
            className="text-red-200 drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
          />
          <p className="text-xl text-red-200">{title}</p>
          <p className="max-w-lg text-sm text-red-200">{message}</p>
        </div>
      </div>
    </div>
  )
}
