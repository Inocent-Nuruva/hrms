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
}: DatePickerPresetsProps) {
  const selectedDate = parseDateValue(value)
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          "flex h-10 w-full items-center justify-start gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors hover:bg-slate-50 focus-visible:border-slate-400",
          "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
          className
        )}
      >
        <CalendarDaysIcon className="size-4 text-slate-500 dark:text-slate-300" />
        <span className={selectedDate ? "" : "text-slate-500 dark:text-slate-400"}>
          {selectedDate ? format(selectedDate, "MM/dd/yyyy") : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
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
