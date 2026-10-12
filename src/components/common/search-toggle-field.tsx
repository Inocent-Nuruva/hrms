"use client"

import * as React from "react"
import { Button } from "@fluentui/react-components"
import { SearchSparkle20Regular } from "@fluentui/react-icons"

import { FluentSearchBox } from "@/components/common/fluent-search-box"
import { cn } from "@/lib/utils"

type SearchToggleFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label?: string
  className?: string
  active?: boolean
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

export function SearchToggleField({
  value,
  onChange,
  placeholder,
  label = "Search",
  className,
  active,
  onKeyDown,
}: SearchToggleFieldProps) {
  const [isOpen, setIsOpen] = React.useState(Boolean(value))
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (value.trim()) {
      setIsOpen(true)
    }
  }, [value])

  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isOpen])

  function handleClose() {
    onChange("")
    setIsOpen(false)
  }

  const highlighted = Boolean(active ?? value.trim())

  if (!isOpen) {
    return (
      <div className={cn("flex shrink-0 items-center", className)}>
        <Button
          appearance={highlighted ? "primary" : "subtle"}
          size="small"
          icon={<SearchSparkle20Regular />}
          aria-label={`Open ${label.toLowerCase()}`}
          title={label}
          className="!size-8 !min-w-8"
          onClick={() => setIsOpen(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-w-0 w-full max-w-full flex-1 items-center sm:min-w-[14rem] sm:max-w-xs",
        className
      )}
    >
      <FluentSearchBox
        ref={inputRef}
        size="small"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(_event, data) => onChange(data.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            handleClose()
            return
          }
          onKeyDown?.(event)
        }}
        className="w-full min-w-0"
      />
    </div>
  )
}
