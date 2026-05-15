"use client"

export const ERROR_ALERT_EVENT = "hrms:error-alert"

export function showErrorAlert(message: string, title = "Something went wrong") {
  if (typeof window === "undefined") {
    return
  }
  window.dispatchEvent(
    new CustomEvent(ERROR_ALERT_EVENT, {
      detail: { title, message },
    })
  )
}

