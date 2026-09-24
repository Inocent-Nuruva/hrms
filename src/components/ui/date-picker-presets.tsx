"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { CalendarDaysIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

function parseDateValue(value: string) {
  if (!value.trim()) {
    return undefined
  }
  const parsed = parse(value, "yyyy-MM-dd", new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function DatePickerPresets({
  value,
  onChange,
  placeholder = "Select date",
  className,
  id,
  appearance = "default",
}: DatePickerPresetsProps) {
  const selectedDate = parseDateValue(value)
  const [open, setOpen] = React.useState(false)
  const onPrimary = appearance === "onPrimary"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          "flex h-10 w-full items-center justify-start gap-2 rounded-md border px-3 text-sm outline-none transition-colors",
          onPrimary
            ? "border-white/30 bg-white/10 text-white hover:bg-white/20 focus-visible:border-white/50"
            : [
                // High-contrast field chrome for normal surfaces / dark mode.
                "border-input bg-background text-foreground shadow-xs hover:border-primary/30 hover:bg-muted/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
              ],
          className
        )}
      >
        <CalendarDaysIcon
          className={cn(
            "size-4 shrink-0",
            onPrimary
              ? "text-white/80"
              : "text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "truncate",
            onPrimary
              ? selectedDate
                ? "font-medium text-white"
                : "text-white/70"
              : selectedDate
                ? "font-medium text-foreground"
                : "text-muted-foreground"
          )}
        >
          {selectedDate ? format(selectedDate, "d MMM yyyy") : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto border border-border bg-popover p-0 text-popover-foreground shadow-md" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(nextDate) => {
            if (!nextDate) {
              onChange("")
              setOpen(false)
              return
            }
            onChange(format(nextDate, "yyyy-MM-dd"))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
