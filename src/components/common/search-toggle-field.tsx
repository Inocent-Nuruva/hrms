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
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const hasValue = value.trim().length > 0

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && hasValue) {
      event.preventDefault()
      onChange("")
      return
    }
    onKeyDown?.(event)
  }

  return (
    <label
      className={cn(
        "flex h-8 w-[13.5rem] max-w-full shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 transition-colors dark:border-border dark:bg-background dark:text-foreground",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25",
        className,
      )}
    >
      <SearchIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
      <input
        ref={inputRef}
        aria-label={label}
        className="min-w-0 w-full border-0 bg-transparent p-0 text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:text-foreground dark:placeholder:text-muted-foreground"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {hasValue ? (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          title="Clear"
          className="inline-flex size-4 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-primary"
          onClick={() => {
            onChange("")
            inputRef.current?.focus()
          }}
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </label>
  )
}
