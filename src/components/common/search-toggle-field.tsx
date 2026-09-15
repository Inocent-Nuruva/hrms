"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"

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
        <button
          type="button"
          aria-label={`Open ${label.toLowerCase()}`}
          title={label}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
            highlighted
              ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
              : "border-sky-200/80 bg-sky-50/70 text-sky-700 hover:bg-sky-100 hover:text-sky-800",
          )}
          onClick={() => setIsOpen(true)}
        >
          <SearchIcon className="size-3.5" />
        </button>
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
      <div className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50/80 px-2 text-xs text-foreground transition-all duration-200">
        <SearchIcon className="size-3.5 shrink-0 text-sky-700" />
        <input
          ref={inputRef}
          aria-label={label}
          className="min-w-0 w-full border-0 bg-transparent p-0 text-xs text-foreground outline-none placeholder:text-muted-foreground"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          aria-label={`Close ${label.toLowerCase()}`}
          title={`Close ${label.toLowerCase()}`}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={handleClose}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
