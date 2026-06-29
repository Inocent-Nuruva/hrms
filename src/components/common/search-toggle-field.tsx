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
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

export function SearchToggleField({
  value,
  onChange,
  placeholder,
  label = "Search",
  className,
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

  if (!isOpen) {
    return (
      <div className={cn("flex items-center", className)}>
        <button
          type="button"
          aria-label={`Open ${label.toLowerCase()}`}
          title={label}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          onClick={() => setIsOpen(true)}
        >
          <SearchIcon className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className={cn("flex min-w-[220px] flex-1 items-center", className)}>
      <div className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 transition-all duration-200">
        <SearchIcon className="size-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          aria-label={label}
          className="w-full border-0 bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          aria-label={`Close ${label.toLowerCase()}`}
          title={`Close ${label.toLowerCase()}`}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          onClick={handleClose}
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
