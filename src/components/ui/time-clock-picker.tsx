"use client"

import { TimeInput } from "@/components/ui/time-input"

type TimeClockPickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  "aria-label"?: string
  id?: string
  minuteStep?: number
}

/** Fluent UI time picker with the compact value API used by attendance filters. */
export function TimeClockPicker({
  value,
  onChange,
  placeholder = "Select time",
  className,
  "aria-label": ariaLabel = "Select time",
  id,
  minuteStep = 5,
}: TimeClockPickerProps) {
  return (
    <TimeInput
      id={id}
      aria-label={ariaLabel}
      className={className}
      increment={minuteStep}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
