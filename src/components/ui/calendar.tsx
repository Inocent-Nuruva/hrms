"use client"

import * as React from "react"
import {
  Calendar as HeroCalendar,
} from "@heroui/react"
import {
  fromDateToLocal,
  getLocalTimeZone,
  type DateValue,
} from "@internationalized/date"

import { cn } from "@/lib/utils"

type CalendarProps = {
  className?: string
  mode?: "single"
  captionLayout?: string
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  fromYear?: number
  toYear?: number
}

function toCalendarValue(date?: Date) {
  if (!date) {
    return undefined
  }

  return fromDateToLocal(new Date(date.getFullYear(), date.getMonth(), date.getDate()))
}

function fromCalendarValue(value: DateValue | null | undefined) {
  if (!value) {
    return undefined
  }

  if ("timeZone" in value) {
    return value.toDate()
  }

  return value.toDate(getLocalTimeZone())
}

export function Calendar({
  className,
  selected,
  onSelect,
  fromYear,
  toYear,
  mode,
  captionLayout,
}: CalendarProps) {
  // `mode` and `captionLayout` are accepted for API compatibility with callers
  // (e.g. shadcn-style usages) but have no effect on this HeroUI-backed calendar.
  void mode
  void captionLayout
  const value = React.useMemo(() => toCalendarValue(selected), [selected])
  const minValue = React.useMemo(
    () => (typeof fromYear === "number" ? toCalendarValue(new Date(fromYear, 0, 1)) : undefined),
    [fromYear]
  )
  const maxValue = React.useMemo(
    () => (typeof toYear === "number" ? toCalendarValue(new Date(toYear, 11, 31)) : undefined),
    [toYear]
  )

  return (
    <div
      className={cn(
        "w-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40",
        className
      )}
    >
      <HeroCalendar
        aria-label="Event date"
        value={value}
        minValue={minValue}
        maxValue={maxValue}
        onChange={(nextValue) => onSelect?.(fromCalendarValue(nextValue))}
        className="calendar-modern w-full min-w-[18rem]"
      >
        <HeroCalendar.Header className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <HeroCalendar.NavButton
            slot="previous"
            className="rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          />
          <HeroCalendar.YearPickerTrigger className="flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            <HeroCalendar.YearPickerTriggerHeading />
            <HeroCalendar.YearPickerTriggerIndicator />
          </HeroCalendar.YearPickerTrigger>
          <HeroCalendar.NavButton
            slot="next"
            className="rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          />
        </HeroCalendar.Header>

        <HeroCalendar.Grid className="w-full">
          <HeroCalendar.GridHeader>
            {(day) => (
              <HeroCalendar.HeaderCell className="text-center text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {day}
              </HeroCalendar.HeaderCell>
            )}
          </HeroCalendar.GridHeader>
          <HeroCalendar.GridBody>
            {(date) => (
              <HeroCalendar.Cell
                date={date}
                className="rounded-xl text-sm font-medium text-slate-700 transition data-[hovered=true]:bg-slate-100 data-[today=true]:ring-1 data-[today=true]:ring-slate-300 data-[selected=true]:bg-slate-900 data-[selected=true]:text-white data-[outside-month=true]:text-slate-300 data-[disabled=true]:text-slate-300 dark:text-slate-100 dark:data-[hovered=true]:bg-slate-800 dark:data-[today=true]:ring-slate-600 dark:data-[selected=true]:bg-white dark:data-[selected=true]:text-slate-900 dark:data-[outside-month=true]:text-slate-600 dark:data-[disabled=true]:text-slate-700"
              />
            )}
          </HeroCalendar.GridBody>
        </HeroCalendar.Grid>

        <HeroCalendar.YearPickerGrid>
          <HeroCalendar.YearPickerGridBody>
            {({ year }) => (
              <HeroCalendar.YearPickerCell
                year={year}
                className="rounded-xl text-sm font-medium text-slate-700 transition data-[hovered=true]:bg-slate-100 data-[selected=true]:bg-slate-900 data-[selected=true]:text-white dark:text-slate-100 dark:data-[hovered=true]:bg-slate-800 dark:data-[selected=true]:bg-white dark:data-[selected=true]:text-slate-900"
              />
            )}
          </HeroCalendar.YearPickerGridBody>
        </HeroCalendar.YearPickerGrid>
      </HeroCalendar>
    </div>
  )
}
