"use client"

export const SUCCESS_ALERT_EVENT = "hrms:success-alert"

export function showSuccessAlert(message: string, title = "Done") {
  if (typeof window === "undefined") {
    return
  }
  window.dispatchEvent(
    new CustomEvent(SUCCESS_ALERT_EVENT, {
      detail: { title, message },
    })
  )
}

