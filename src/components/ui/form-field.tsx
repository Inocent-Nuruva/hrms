"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const CONTROL_SELECTOR = [
  "input:not([type=hidden]):not([type=file])",
  "select",
  "textarea",
  "[role=combobox]",
  "[role=textbox]",
  "button[aria-haspopup]",
].join(",")

/**
 * The one field layout used by every form: label (with a red star when
 * required), the control, then either an error message or a hint.
 *
 * The error outlines Fluent and native controls inside it in red and is
 * announced to screen readers. When `htmlFor` is not given, the label and
 * message are linked to the first control inside automatically
 * (aria-labelledby / aria-describedby), so every field keeps its name.
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  className,
  children,
}: {
  label: React.ReactNode
  /** id of the control, so clicking the label focuses it. */
  htmlFor?: string
  required?: boolean
  error?: string | null
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const autoId = React.useId()
  const labelId = `${autoId}-label`
  const messageId = htmlFor ? `${htmlFor}-message` : `${autoId}-message`
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const hasMessage = Boolean(error || hint)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const control = container.querySelector<HTMLElement>(CONTROL_SELECTOR)
    if (!control) return
    if (!htmlFor && !control.hasAttribute("aria-label") && !control.hasAttribute("aria-labelledby")) {
      control.setAttribute("aria-labelledby", labelId)
      control.dataset.formFieldLabelled = "true"
    }
    if (hasMessage) {
      const existing = control.getAttribute("aria-describedby") ?? ""
      if (!existing.split(" ").includes(messageId)) {
        control.setAttribute("aria-describedby", `${existing} ${messageId}`.trim())
      }
    }
    if (error) control.setAttribute("aria-invalid", "true")
    else if (control.getAttribute("aria-invalid") === "true" && control.dataset.formFieldInvalid === "true") {
      control.removeAttribute("aria-invalid")
    }
    if (error) control.dataset.formFieldInvalid = "true"
  })

  return (
    <div
      ref={containerRef}
      data-invalid={error ? "true" : undefined}
      className={cn("hrms-form-field grid min-w-0 content-start gap-1.5", className)}
    >
      <label id={labelId} htmlFor={htmlFor} className="text-xs font-medium leading-4 text-foreground">
        {label}
        {required ? (
          <>
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={messageId} role="alert" className="text-[11px] leading-snug text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-[11px] leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
