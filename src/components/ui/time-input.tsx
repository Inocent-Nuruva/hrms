"use client"

import * as React from "react"
import {
  TimePicker,
  type TimePickerProps,
  type TimeSelectionData,
  type TimeSelectionEvents,
} from "@fluentui/react-timepicker-compat"

import { cn } from "@/lib/utils"

type NativeTimeInputProps = Omit<
  React.ComponentProps<"input">,
  "children" | "defaultValue" | "onChange" | "size" | "type" | "value"
> & {
  value?: string | number | readonly string[]
  defaultValue?: string | number | readonly string[]
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  increment?: number
}

function parseTime(value: NativeTimeInputProps["value"]): Date | null {
  if (typeof value !== "string") return null
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return new Date(2000, 0, 1, hours, minutes, 0, 0)
}

function formatTime(value: Date | null) {
  if (!value) return ""
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
}

function dispatchNativeLikeChange(
  _event: TimeSelectionEvents,
  data: TimeSelectionData,
  onChange?: React.ChangeEventHandler<HTMLInputElement>,
) {
  if (!onChange) return

  const value = formatTime(data.selectedTime)
  const target = { value } as HTMLInputElement
  onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>)
}

/** Fluent UI time picker that keeps the native `HH:mm` value contract. */
const TimeInput = React.forwardRef<HTMLInputElement, NativeTimeInputProps>(function TimeInput(
  {
    className,
    defaultValue,
    disabled,
    increment = 30,
    onChange,
    placeholder = "Select time",
    required,
    value,
    ...props
  },
  ref,
) {
  const controlledTime = parseTime(value)
  const initialTime = parseTime(defaultValue)

  return (
    <TimePicker
      {...(props as Omit<TimePickerProps, "onTimeChange">)}
      ref={ref}
      aria-label={props["aria-label"] ?? "Select time"}
      className={cn("w-full min-w-0 max-w-none", className)}
      clearable={!required}
      defaultSelectedTime={initialTime ?? undefined}
      disabled={disabled}
      freeform
      hourCycle="h23"
      increment={increment}
      placeholder={placeholder}
      required={required}
      selectedTime={value === undefined ? undefined : controlledTime}
      value={value === undefined ? undefined : formatTime(controlledTime)}
      onTimeChange={(event, data) => dispatchNativeLikeChange(event, data, onChange)}
    />
  )
})

TimeInput.displayName = "TimeInput"

export { TimeInput }
export type { NativeTimeInputProps as TimeInputProps }
