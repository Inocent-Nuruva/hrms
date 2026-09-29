"use client"

import type * as React from "react"
import type { ToastIntent } from "@fluentui/react-components"

export type AppToastOptions = {
  description?: React.ReactNode
  duration?: number
  id?: string | number
}

export type AppToastEvent = {
  title: React.ReactNode
  intent: ToastIntent | "progress"
  options?: AppToastOptions
}

type ToastListener = (event: AppToastEvent) => void

const listeners = new Set<ToastListener>()
const pending: AppToastEvent[] = []

function publish(event: AppToastEvent) {
  if (listeners.size === 0) {
    pending.push(event)
    return
  }

  listeners.forEach((listener) => listener(event))
}

function notify(
  intent: AppToastEvent["intent"],
  title: React.ReactNode,
  options?: AppToastOptions
) {
  publish({ intent, title, options })
  return options?.id ? String(options.id) : undefined
}

export const toast = {
  success: (title: React.ReactNode, options?: AppToastOptions) => notify("success", title, options),
  error: (title: React.ReactNode, options?: AppToastOptions) => notify("error", title, options),
  warning: (title: React.ReactNode, options?: AppToastOptions) => notify("warning", title, options),
  info: (title: React.ReactNode, options?: AppToastOptions) => notify("info", title, options),
  message: (title: React.ReactNode, options?: AppToastOptions) => notify("info", title, options),
  loading: (title: React.ReactNode, options?: AppToastOptions) => notify("progress", title, options),
}

export function subscribeToAppToasts(listener: ToastListener) {
  listeners.add(listener)
  pending.splice(0).forEach(listener)

  return () => {
    listeners.delete(listener)
  }
}
