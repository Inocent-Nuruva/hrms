"use client"

import * as React from "react"
import { Button, MessageBar, MessageBarBody } from "@fluentui/react-components"

import {
  getOnboardingDeviceProvisioning,
  retryOnboardingDeviceProvisioning,
  type OnboardingDeviceProvisioningStatus as DeviceProvisioning,
} from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"

function formatWhen(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString()
}

/** What HR should read about the post-activation device assignment. */
export function describeDeviceProvisioning(operation: DeviceProvisioning) {
  const devices = `${operation.device_count} device${operation.device_count === 1 ? "" : "s"}`
  if (operation.status === "completed") {
    return { intent: "success" as const, title: "Devices assigned", body: `Access was set up on ${devices}.`, canRetry: false }
  }
  if (operation.exhausted) {
    return {
      intent: "error" as const,
      title: "Device assignment stopped retrying",
      body: `${operation.attempt_count} attempts failed for ${devices}. Last error: ${operation.last_error ?? "unknown"}. Fix the device issue, then retry.`,
      canRetry: true,
    }
  }
  if (operation.status === "failed") {
    const next = formatWhen(operation.next_retry_at)
    return {
      intent: "warning" as const,
      title: "Device assignment is retrying",
      body: `Attempt ${operation.attempt_count} of ${operation.max_attempts} failed${operation.last_error ? `: ${operation.last_error}` : ""}.${next ? ` Next automatic try ${next}.` : ""}`,
      canRetry: true,
    }
  }
  return { intent: "info" as const, title: "Assigning devices", body: `Access is being set up on ${devices}.`, canRetry: false }
}

export function OnboardingDeviceProvisioningStatus({
  token,
  requestId,
  canRetry,
  refreshKey,
}: {
  token: string
  requestId: number
  canRetry: boolean
  refreshKey?: string | number
}) {
  const [operation, setOperation] = React.useState<DeviceProvisioning | null>(null)
  const [retrying, setRetrying] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    getOnboardingDeviceProvisioning(token, requestId)
      .then((result) => {
        if (!cancelled) setOperation(result?.data ?? null)
      })
      .catch(() => {
        // Status is supplementary; the rest of the workspace still works without it.
        if (!cancelled) setOperation(null)
      })
    return () => {
      cancelled = true
    }
  }, [token, requestId, refreshKey])

  if (!operation) return null
  const view = describeDeviceProvisioning(operation)

  async function retry() {
    setRetrying(true)
    try {
      const result = await retryOnboardingDeviceProvisioning(token, requestId)
      if (result?.data) setOperation(result.data)
      if (result?.data?.status === "completed") showSuccessAlert(result.message)
      else showErrorAlert(result?.message ?? "Devices are not assigned yet.")
    } catch (cause) {
      showErrorAlert(cause instanceof Error ? cause.message : "Could not retry device assignment.")
    } finally {
      setRetrying(false)
    }
  }

  return (
    <MessageBar intent={view.intent} aria-label="Device assignment status">
      <MessageBarBody>
        <strong>{view.title}</strong>
        <p>{view.body}</p>
        {view.canRetry && canRetry ? (
          <Button size="small" appearance="primary" disabled={retrying} onClick={() => void retry()}>
            {retrying ? "Retrying…" : "Retry now"}
          </Button>
        ) : null}
      </MessageBarBody>
    </MessageBar>
  )
}
