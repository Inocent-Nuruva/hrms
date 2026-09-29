"use client"

import * as React from "react"

import { DateInput } from "@/components/ui/date-input"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type DateTimeInputChangeEvent = {
  target: { value: string }
  currentTarget: { value: string }
}

type DateTimeInputProps = {
  value?: string | null
  onChange?: (event: DateTimeInputChangeEvent) => void
  onValueChange?: (value: string) => void
  id?: string
  className?: string
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  datePlaceholder?: string
  "aria-label"?: string
}

function splitDateTime(value: string | null | undefined) {
  const normalized = value?.trim() ?? ""
  if (!normalized) return { date: "", time: "" }
  const [date = "", rawTime = ""] = normalized.split(/[T ]/, 2)
  return { date, time: rawTime.slice(0, 5) }
}

function combineDateTime(date: string, time: string) {
  if (!date) return ""
  return `${date}T${time || "00:00"}`
}

export function DateTimeInput({
  value,
  onChange,
  onValueChange,
  id,
  className,
  required,
  disabled,
  min,
  max,
  datePlaceholder = "Select date",
  "aria-label": ariaLabel,
}: DateTimeInputProps) {
  const parts = splitDateTime(value)
  const [draftTime, setDraftTime] = React.useState(parts.time)

  React.useEffect(() => {
    setDraftTime(parts.time)
  }, [parts.time])

  const emit = React.useCallback(
    (nextValue: string) => {
      const event = {
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      }
      onChange?.(event)
      onValueChange?.(nextValue)
    },
    [onChange, onValueChange],
  )

  return (
    <div
      className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)_7.5rem] gap-2", className)}
      data-slot="date-time-input"
    >
      <DateInput
        id={id}
        aria-label={ariaLabel ? `${ariaLabel} date` : "Date"}
        className="max-w-none"
        disabled={disabled}
        required={required}
        value={parts.date}
        min={splitDateTime(min).date || undefined}
        max={splitDateTime(max).date || undefined}
        placeholder={datePlaceholder}
        onValueChange={(nextDate) => emit(combineDateTime(nextDate, draftTime))}
      />
      <Input
        aria-label={ariaLabel ? `${ariaLabel} time` : "Time"}
        type="time"
        disabled={disabled}
        required={required}
        value={draftTime}
        min={splitDateTime(min).time || undefined}
        max={splitDateTime(max).time || undefined}
        onChange={(event) => {
          const nextTime = event.target.value
          setDraftTime(nextTime)
          if (parts.date) emit(combineDateTime(parts.date, nextTime))
        }}
      />
    </div>
  )
}
