"use client"

import * as React from "react"
import { Progress } from "@base-ui-components/react/progress"

type ExampleProgressProps = {
  label?: string
  value?: number
  helperText?: string
}

export default function ExampleProgress({
  label = "Export data",
  value,
  helperText,
}: ExampleProgressProps) {
  const [internalValue, setInternalValue] = React.useState(20)

  React.useEffect(() => {
    if (typeof value === "number") {
      return
    }

    const interval = window.setInterval(() => {
      setInternalValue((current) => Math.min(100, Math.round(current + Math.random() * 25)))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [value])

  const resolvedValue = typeof value === "number" ? value : internalValue

  return (
    <Progress.Root className="grid w-full gap-y-2" value={resolvedValue}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Progress.Label className="truncate text-sm font-medium text-foreground">
          {label}
        </Progress.Label>
        <Progress.Value className="text-right text-sm text-muted-foreground" />
      </div>
      <Progress.Track className="h-1.5 overflow-hidden rounded bg-slate-200 shadow-[inset_0_0_0_1px] shadow-slate-200">
        <Progress.Indicator className="block h-full bg-slate-600 transition-all duration-500" />
      </Progress.Track>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </Progress.Root>
  )
}
