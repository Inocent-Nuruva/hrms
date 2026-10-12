"use client"

import * as React from "react"
import {
  Spinner,
  Toast,
  ToastBody,
  ToastTitle,
  Toaster as FluentToaster,
  type ToastPosition,
  useId,
  useToastController,
} from "@fluentui/react-components"

import {
  subscribeToAppToasts,
  type AppToastEvent,
} from "@/components/ui/fluent-toast-store"

type LegacyToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

type AppToasterProps = {
  position?: LegacyToastPosition | ToastPosition
}

function resolvePosition(position?: AppToasterProps["position"]): ToastPosition {
  switch (position) {
    case "top-left":
      return "top-start"
    case "top-center":
      return "top"
    case "bottom-left":
      return "bottom-start"
    case "bottom-center":
      return "bottom"
    case "bottom-right":
      return "bottom-end"
    case "top-right":
    default:
      return position && !position.includes("right") ? (position as ToastPosition) : "top-end"
  }
}

export function Toaster({ position }: AppToasterProps) {
  const toasterId = useId("hrms-fluent-toaster")
  const { dispatchToast } = useToastController(toasterId)

  const showToast = React.useCallback(
    ({ title, intent, options }: AppToastEvent) => {
      const isProgress = intent === "progress"
      dispatchToast(
        <Toast>
          <ToastTitle media={isProgress ? <Spinner size="tiny" /> : undefined}>
            {title}
          </ToastTitle>
          {options?.description ? <ToastBody>{options.description}</ToastBody> : null}
        </Toast>,
        {
          intent: isProgress ? "info" : intent,
          timeout: options?.duration ?? (isProgress ? -1 : 4500),
          toastId: options?.id ? String(options.id) : undefined,
        }
      )
    },
    [dispatchToast]
  )

  React.useEffect(() => {
    const unsubscribe = subscribeToAppToasts(showToast)
    return unsubscribe
  }, [showToast])

  return (
    <FluentToaster
      toasterId={toasterId}
      position={resolvePosition(position)}
      pauseOnHover
      pauseOnWindowBlur
      className="!z-[10000]"
    />
  )
}
