"use client"

import * as React from "react"
import { addDays } from "date-fns"
import { DayPicker } from "react-day-picker"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const [internalMonth, setInternalMonth] = React.useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )

  const controlledMonth =
    "month" in props && props.month instanceof Date ? props.month : undefined
  const currentMonth = controlledMonth ?? internalMonth

  const setCalendarMonth = React.useCallback(
    (nextMonth: Date) => {
      setInternalMonth(nextMonth)
      props.onMonthChange?.(nextMonth)
    },
    [props]
  )

  const isSingleMode = "mode" in props && props.mode === "single"
  const onSelectSingle =
    "onSelect" in props
      ? (props.onSelect as ((date: Date | undefined) => void) | undefined)
      : undefined

  const applyPreset = (offset: number) => {
    const nextDate = addDays(new Date(), offset)
    onSelectSingle?.(nextDate)
    setCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
  }

  const isDropdownCaption =
    typeof props.captionLayout === "string" && props.captionLayout.startsWith("dropdown")

  return (
    <Card className={cn("mx-auto w-fit max-w-[300px]", className)} size="sm">
      <CardContent>
        <DayPicker
          showOutsideDays={showOutsideDays}
          month={currentMonth}
          onMonthChange={setCalendarMonth}
          fixedWeeks
          className="p-0 [--cell-size:--spacing(9.5)]"
          classNames={{
            months: "flex flex-col sm:flex-row gap-4",
            month: "space-y-4",
            month_caption: "flex justify-center pt-1 relative items-center",
            caption_label: isDropdownCaption ? "hidden" : "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            button_previous: cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "size-7 bg-transparent p-0 opacity-70 hover:opacity-100 absolute left-1"
            ),
            button_next: cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "size-7 bg-transparent p-0 opacity-70 hover:opacity-100 absolute right-1"
            ),
            month_grid: "w-full border-collapse space-y-1",
            weekdays: "flex",
            weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
            week: "flex w-full mt-2",
            day: "h-9 w-9 p-0 text-center text-sm relative [&:has([aria-selected])]:bg-accent [&:has([data-outside=true][aria-selected=true])]:bg-accent/50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day_button: cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
            ),
            selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            today: "bg-accent text-accent-foreground",
            outside: "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            disabled: "text-muted-foreground opacity-50",
            range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            hidden: "invisible",
            ...classNames,
          }}
          components={{
            Chevron: ({ orientation }) =>
              orientation === "left" ? (
                <ChevronLeftIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              ),
          }}
          {...props}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t">
        {[
          { label: "Today", value: 0 },
          { label: "Tomorrow", value: 1 },
          { label: "In 3 days", value: 3 },
          { label: "In a week", value: 7 },
          { label: "In 2 weeks", value: 14 },
        ].map((preset) => (
          <Button
            key={preset.value}
            variant="outline"
            size="sm"
            className="flex-1"
            type="button"
            onClick={() => applyPreset(preset.value)}
            disabled={!onSelectSingle || !isSingleMode}
          >
            {preset.label}
          </Button>
        ))}
      </CardFooter>
    </Card>
  )
}

export { Calendar }
