"use client"

import { DateInput } from "@/components/ui/date-input"
import { cn } from "@/lib/utils"

type DatePickerPresetsProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  /** `onPrimary` matches glass buttons on brand/header backgrounds. */
  appearance?: "default" | "onPrimary"
}

/** Backwards-compatible adapter that moves older call sites onto Fluent DatePicker. */
export function DatePickerPresets({
  value,
  onChange,
  placeholder = "Select date",
  className,
  id,
  appearance = "default",
}: DatePickerPresetsProps) {
  return (
    <DateInput
      aria-label={placeholder}
      id={id}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      className={cn(
        "max-w-none",
        appearance === "onPrimary" &&
          "[&_.fui-Input]:!border-white/40 [&_.fui-Input]:!bg-white/10 [&_.fui-Input]:!text-white",
        className,
      )}
    />
  )
}
