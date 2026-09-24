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
        "w-fit rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-xl",
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
            className="rounded-md border border-border bg-background text-foreground shadow-xs hover:border-primary/30 hover:bg-muted"
          />
          <HeroCalendar.YearPickerTrigger className="flex items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/75">
            <HeroCalendar.YearPickerTriggerHeading />
            <HeroCalendar.YearPickerTriggerIndicator />
          </HeroCalendar.YearPickerTrigger>
          <HeroCalendar.NavButton
            slot="next"
            className="rounded-md border border-border bg-background text-foreground shadow-xs hover:border-primary/30 hover:bg-muted"
          />
        </HeroCalendar.Header>

        <HeroCalendar.Grid className="w-full">
          <HeroCalendar.GridHeader>
            {(day) => (
              <HeroCalendar.HeaderCell className="text-center text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {day}
              </HeroCalendar.HeaderCell>
            )}
          </HeroCalendar.GridHeader>
          <HeroCalendar.GridBody>
            {(date) => (
              <HeroCalendar.Cell
                date={date}
                className="rounded-sm text-sm font-medium text-foreground transition-colors data-[hovered=true]:bg-muted data-[today=true]:ring-1 data-[today=true]:ring-primary/40 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[outside-month=true]:text-muted-foreground/45 data-[disabled=true]:text-muted-foreground/35"
              />
            )}
          </HeroCalendar.GridBody>
        </HeroCalendar.Grid>

        <HeroCalendar.YearPickerGrid>
          <HeroCalendar.YearPickerGridBody>
            {({ year }) => (
              <HeroCalendar.YearPickerCell
                year={year}
                className="rounded-sm text-sm font-medium text-foreground transition-colors data-[hovered=true]:bg-muted data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
              />
            )}
          </HeroCalendar.YearPickerGridBody>
        </HeroCalendar.YearPickerGrid>
      </HeroCalendar>
    </div>
  )
}
