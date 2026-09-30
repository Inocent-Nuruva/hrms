"use client"

import * as React from "react"
import { ProgressBar } from "@fluentui/react-components"

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
    <div className="grid w-full gap-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        <span className="text-right text-sm text-muted-foreground">{Math.round(resolvedValue)}%</span>
      </div>
      <ProgressBar value={resolvedValue} max={100} thickness="large" aria-label={label} />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  )
}
