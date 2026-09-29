"use client"

import * as React from "react"

import { toast } from "@/components/ui/fluent-toast-store"

type ToastStateIntent = "success" | "error" | "warning" | "info"

export type FluentToastResult = {
  tone: ToastStateIntent
  text: string
}

/**
 * Bridges legacy local notification state into the app-wide Fluent toaster.
 * Clearing after dispatch lets the same message be emitted by a later action.
 */
export function useFluentToastState(
  value: string | null,
  setValue: React.Dispatch<React.SetStateAction<string | null>>,
  intent: ToastStateIntent,
) {
  React.useEffect(() => {
    if (!value) return

    toast[intent](value)
    setValue(null)
  }, [intent, setValue, value])
}

export function useFluentToastResultState<T extends FluentToastResult>(
  value: T | null,
  setValue: React.Dispatch<React.SetStateAction<T | null>>,
) {
  React.useEffect(() => {
    if (!value) return

    toast[value.tone](value.text)
    setValue(null)
  }, [setValue, value])
}
