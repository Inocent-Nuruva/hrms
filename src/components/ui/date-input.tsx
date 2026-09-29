"use client"

import * as React from "react"
import {
  DatePicker,
  type DatePickerProps,
} from "@fluentui/react-datepicker-compat"

import { cn } from "@/lib/utils"

export type DateInputChangeEvent = {
  target: { value: string }
  currentTarget: { value: string }
}

export type DateInputProps = Omit<
  DatePickerProps,
  "defaultValue" | "formatDate" | "maxDate" | "minDate" | "onChange" | "onSelectDate" | "value"
> & {
  value?: string | null
  defaultValue?: string | null
  min?: string
  max?: string
  onChange?: (event: DateInputChangeEvent) => void
  onValueChange?: (value: string) => void
  onSelectDate?: (date: Date | null | undefined) => void
  formatDate?: DatePickerProps["formatDate"]
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function toIsoDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function defaultFormatDate(date?: Date): string {
  if (!date) return ""
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  {
    className,
    defaultValue,
    formatDate = defaultFormatDate,
    max,
    min,
    onChange,
    onSelectDate,
    onValueChange,
    placeholder = "Select a date...",
    value,
    ...props
  },
  ref,
) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const stringValue = isControlled ? (value ?? "") : internalValue

  const handleSelectDate = React.useCallback(
    (date: Date | null | undefined) => {
      const nextValue = toIsoDate(date)
      if (!isControlled) setInternalValue(nextValue)
      const event = {
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      }
      onChange?.(event)
      onValueChange?.(nextValue)
      onSelectDate?.(date)
    },
    [isControlled, onChange, onSelectDate, onValueChange],
  )

  return (
    <DatePicker
      {...props}
      ref={ref}
      className={cn("w-full max-w-[300px]", className)}
      data-slot="date-input"
      formatDate={formatDate}
      maxDate={parseIsoDate(max) ?? undefined}
      minDate={parseIsoDate(min) ?? undefined}
      onSelectDate={handleSelectDate}
      placeholder={placeholder}
      value={parseIsoDate(stringValue)}
    />
  )
})

export { DateInput }
